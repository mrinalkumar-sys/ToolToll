import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { InsufficientBalanceError, NotFoundError } from '../../utils/errors';
import { calculatePlatformFee } from '../../utils/money';

export type AccountName =
  | 'USER_WALLET'
  | 'WALLET_RESERVED'
  | 'CREATOR_PAYABLE'
  | 'PLATFORM_REVENUE'
  | 'PAYOUT_CLEARING'
  | 'EXTERNAL_PAYPAL';

export interface LedgerTransaction {
  walletId?: string | null;
  callId?: string | null;
  account: AccountName;
  entryType: 'DEBIT' | 'CREDIT';
  amount: bigint;
  balanceAfter?: bigint | null;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

/**
 * Append-only double-entry ledger service
 */
export class LedgerService {
  /**
   * Atomically reserve funds for a paid tool execution
   * Invariant 5: Row-level lock ensures concurrent calls cannot overspend.
   */
  static async reserveFunds(params: {
    walletId: string;
    amountMicroUsd: bigint;
    callId: string;
    agentId: string;
    toolId: string;
  }) {
    const { walletId, amountMicroUsd, callId, agentId, toolId } = params;

    return await prisma.$transaction(async (tx) => {
      // Row-level lock on the consumer's wallet
      const wallets = await tx.$queryRaw<Array<{ id: string; balance: bigint; reservedBalance: bigint }>>`
        SELECT id, balance, "reservedBalance"
        FROM wallets
        WHERE id = ${walletId}
        FOR UPDATE
      `;

      if (!wallets || wallets.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = wallets[0];

      if (wallet.balance < amountMicroUsd) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: ${wallet.balance.toString()} micro-USD, Required: ${amountMicroUsd.toString()} micro-USD`
        );
      }

      const newBalance = wallet.balance - amountMicroUsd;
      const newReserved = wallet.reservedBalance + amountMicroUsd;

      // Update wallet balances atomically
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: newBalance,
          reservedBalance: newReserved,
        },
      });

      // Create reservation record with 5-minute expiry
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const reservation = await tx.walletReservation.create({
        data: {
          walletId,
          agentId,
          toolId,
          callId,
          amount: amountMicroUsd,
          status: 'RESERVED',
          expiresAt,
        },
      });

      // Append double-entry ledger records
      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId,
            callId,
            account: 'USER_WALLET',
            entryType: 'DEBIT',
            amount: amountMicroUsd,
            balanceAfter: newBalance,
            description: `Hold funds for tool call ${callId}`,
            referenceType: 'CALL_RESERVE',
            referenceId: callId,
          },
          {
            walletId,
            callId,
            account: 'WALLET_RESERVED',
            entryType: 'CREDIT',
            amount: amountMicroUsd,
            balanceAfter: newReserved,
            description: `Escrow reserved funds for call ${callId}`,
            referenceType: 'CALL_RESERVE',
            referenceId: callId,
          },
        ],
      });

      return reservation;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Finalize and capture reserved funds upon successful tool execution
   */
  static async captureReservation(params: {
    callId: string;
    creatorId: string;
    toolId: string;
    priceMicroUsd: bigint;
    platformFeeBps: number;
  }) {
    const { callId, creatorId, toolId, priceMicroUsd, platformFeeBps } = params;

    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.walletReservation.findUnique({
        where: { callId },
      });

      if (!reservation) {
        throw new NotFoundError(`No reservation found for call ${callId}`);
      }

      if (reservation.status === 'CAPTURED') {
        return reservation; // Idempotent
      }

      // Lock wallet
      const wallets = await tx.$queryRaw<Array<{ id: string; balance: bigint; reservedBalance: bigint }>>`
        SELECT id, balance, "reservedBalance"
        FROM wallets
        WHERE id = ${reservation.walletId}
        FOR UPDATE
      `;

      const wallet = wallets[0];
      const newReserved = wallet.reservedBalance - reservation.amount;

      await tx.wallet.update({
        where: { id: reservation.walletId },
        data: { reservedBalance: newReserved < 0n ? 0n : newReserved },
      });

      await tx.walletReservation.update({
        where: { id: reservation.id },
        data: { status: 'CAPTURED' },
      });

      // Calculate split
      const { platformFeeMicroUsd, creatorEarningsMicroUsd } = calculatePlatformFee(
        priceMicroUsd,
        platformFeeBps
      );

      // Record creator earning
      await tx.creatorEarning.create({
        data: {
          creatorId,
          toolCallId: callId,
          toolId,
          grossMicroUsd: priceMicroUsd,
          platformFeeMicroUsd,
          netMicroUsd: creatorEarningsMicroUsd,
          status: 'PAYABLE',
        },
      });

      // Append double-entry ledger entries
      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId: reservation.walletId,
            callId,
            account: 'WALLET_RESERVED',
            entryType: 'DEBIT',
            amount: priceMicroUsd,
            description: `Release escrow for captured call ${callId}`,
            referenceType: 'CALL_CAPTURE',
            referenceId: callId,
          },
          {
            walletId: reservation.walletId,
            callId,
            account: 'CREATOR_PAYABLE',
            entryType: 'CREDIT',
            amount: creatorEarningsMicroUsd,
            description: `Earnings credited for creator ${creatorId}`,
            referenceType: 'CALL_CAPTURE',
            referenceId: callId,
          },
          {
            walletId: reservation.walletId,
            callId,
            account: 'PLATFORM_REVENUE',
            entryType: 'CREDIT',
            amount: platformFeeMicroUsd,
            description: `Platform fee (${platformFeeBps} bps) on call ${callId}`,
            referenceType: 'CALL_CAPTURE',
            referenceId: callId,
          },
        ],
      });

      return reservation;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Release reserved funds back to available balance (Compensating entry on failure)
   * Invariant 4: Append-only, never deletes or edits entries.
   */
  static async releaseReservation(callId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.walletReservation.findUnique({
        where: { callId },
      });

      if (!reservation) {
        return null;
      }

      if (reservation.status !== 'RESERVED') {
        return reservation; // Already captured or released
      }

      const wallets = await tx.$queryRaw<Array<{ id: string; balance: bigint; reservedBalance: bigint }>>`
        SELECT id, balance, "reservedBalance"
        FROM wallets
        WHERE id = ${reservation.walletId}
        FOR UPDATE
      `;

      const wallet = wallets[0];
      const newBalance = wallet.balance + reservation.amount;
      const newReserved = wallet.reservedBalance - reservation.amount;

      await tx.wallet.update({
        where: { id: reservation.walletId },
        data: {
          balance: newBalance,
          reservedBalance: newReserved < 0n ? 0n : newReserved,
        },
      });

      await tx.walletReservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' },
      });

      // Append compensating ledger entries
      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId: reservation.walletId,
            callId,
            account: 'WALLET_RESERVED',
            entryType: 'DEBIT',
            amount: reservation.amount,
            description: `Compensating release from reserved: ${reason}`,
            referenceType: 'CALL_REVERSAL',
            referenceId: callId,
          },
          {
            walletId: reservation.walletId,
            callId,
            account: 'USER_WALLET',
            entryType: 'CREDIT',
            amount: reservation.amount,
            balanceAfter: newBalance,
            description: `Refunded unspent hold: ${reason}`,
            referenceType: 'CALL_REVERSAL',
            referenceId: callId,
          },
        ],
      });

      return reservation;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Credit user wallet on verified top-up (PayPal or Mock)
   */
  static async creditTopup(params: {
    walletId: string;
    amountMicroUsd: bigint;
    provider: 'PAYPAL' | 'MOCK';
    referenceId: string;
  }) {
    const { walletId, amountMicroUsd, provider, referenceId } = params;

    return await prisma.$transaction(async (tx) => {
      const wallets = await tx.$queryRaw<Array<{ id: string; balance: bigint; reservedBalance: bigint }>>`
        SELECT id, balance, "reservedBalance"
        FROM wallets
        WHERE id = ${walletId}
        FOR UPDATE
      `;

      if (!wallets || wallets.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = wallets[0];
      const newBalance = wallet.balance + amountMicroUsd;

      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance },
      });

      const topup = await tx.topup.create({
        data: {
          walletId,
          amountMicroUsd,
          provider,
          status: 'COMPLETED',
          paypalOrderId: provider === 'PAYPAL' ? referenceId : null,
        },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId,
            account: 'EXTERNAL_PAYPAL',
            entryType: 'DEBIT',
            amount: amountMicroUsd,
            description: `External deposit via ${provider}: ${referenceId}`,
            referenceType: 'TOPUP',
            referenceId,
          },
          {
            walletId,
            account: 'USER_WALLET',
            entryType: 'CREDIT',
            amount: amountMicroUsd,
            balanceAfter: newBalance,
            description: `Wallet funded via ${provider}`,
            referenceType: 'TOPUP',
            referenceId,
          },
        ],
      });

      return topup;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
