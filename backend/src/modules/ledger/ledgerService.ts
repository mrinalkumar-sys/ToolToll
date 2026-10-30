import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { InsufficientBalanceError, NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors';
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

  /**
   * Atomically process a refund/reversal for a previously charged tool call.
   * Invariants:
   * 1. Row-level lock on the consumer Wallet and ToolCall verification.
   * 2. Prevents duplicate refunds (idempotency).
   * 3. Double-entry balancing compensating entries:
   *    - DEBIT CREATOR_PAYABLE (creatorEarningsMicroUsd)
   *    - DEBIT PLATFORM_REVENUE (platformFeeMicroUsd)
   *    - CREDIT USER_WALLET (priceMicroUsd)
   *    Total DEBITS == Total CREDITS.
   * 4. Updates CreatorEarning to 'REVERSED'.
   * 5. Updates ToolCall to 'REVERSED', isReversed: true, failureReason: reason.
   * 6. Appends AuditLog entry for full auditability.
   */
  static async processCallRefund(params: {
    callId: string;
    userId: string;
    reason: string;
    isAdmin?: boolean;
  }) {
    const { callId, userId, reason, isAdmin } = params;

    // Retry loop for transient concurrent serialization if needed
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Lock ToolCall with row-level lock
          const calls = await tx.$queryRaw<Array<{
            id: string;
            agentId: string;
            priceMicroUsd: bigint;
            status: string;
            isReversed: boolean;
            creatorEarningsMicroUsd: bigint;
            platformFeeMicroUsd: bigint;
          }>>`
            SELECT id, "agentId", "priceMicroUsd", status, "isReversed", "creatorEarningsMicroUsd", "platformFeeMicroUsd"
            FROM tool_calls
            WHERE id = ${callId}
            FOR UPDATE
          `;

          if (!calls || calls.length === 0) {
            throw new NotFoundError(`Execution '${callId}' not found`);
          }

          const call = calls[0];

          // 2. Fetch agent for ownership check
          const agent = await tx.agent.findUnique({
            where: { id: call.agentId },
            select: { userId: true },
          });

          if (!agent || (agent.userId !== userId && !isAdmin)) {
            throw new ForbiddenError('You do not have permission to refund this execution');
          }

          // 3. Idempotency check: if already reversed, return existing status safely without re-crediting
          if (call.isReversed || call.status === 'REVERSED') {
            const wallet = await tx.wallet.findUnique({ where: { userId: agent.userId } });
            return {
              callId: call.id,
              alreadyRefunded: true,
              status: 'REFUNDED' as const,
              refundedAmountMicroUsd: call.priceMicroUsd.toString(),
              newBalanceMicroUsd: (wallet?.balance ?? 0n).toString(),
              message: 'Execution has already been refunded',
            };
          }

          // 4. Verify original charge
          if (call.priceMicroUsd <= 0n) {
            throw new BadRequestError('Cannot refund an execution that was not charged');
          }

          // 5. Lock consumer wallet
          const wallets = await tx.$queryRaw<Array<{ id: string; balance: bigint; reservedBalance: bigint }>>`
            SELECT id, balance, "reservedBalance"
            FROM wallets
            WHERE "userId" = ${agent.userId}
            FOR UPDATE
          `;

          if (!wallets || wallets.length === 0) {
            throw new NotFoundError('Consumer wallet not found');
          }

          const wallet = wallets[0];
          const newBalance = wallet.balance + call.priceMicroUsd;

          // 6. Credit consumer wallet
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });

          // 7. Reverse creator earning if exists
          const creatorEarning = await tx.creatorEarning.findUnique({
            where: { toolCallId: callId },
          });
          if (creatorEarning && creatorEarning.status === 'PAYABLE') {
            await tx.creatorEarning.update({
              where: { id: creatorEarning.id },
              data: { status: 'REVERSED' },
            });
          }

          // 8. Append double-entry ledger entries
          const creatorDebit = call.creatorEarningsMicroUsd;
          const platformFeeDebit = call.platformFeeMicroUsd;

          await tx.ledgerEntry.createMany({
            data: [
              {
                walletId: wallet.id,
                callId,
                account: 'USER_WALLET',
                entryType: 'CREDIT',
                amount: call.priceMicroUsd,
                balanceAfter: newBalance,
                description: `Refund credited for call ${callId}: ${reason}`,
                referenceType: 'REFUND',
                referenceId: callId,
              },
              {
                walletId: wallet.id,
                callId,
                account: 'CREATOR_PAYABLE',
                entryType: 'DEBIT',
                amount: creatorDebit,
                description: `Earning reversed for call ${callId}`,
                referenceType: 'REFUND',
                referenceId: callId,
              },
              {
                walletId: wallet.id,
                callId,
                account: 'PLATFORM_REVENUE',
                entryType: 'DEBIT',
                amount: platformFeeDebit,
                description: `Platform fee reversed for call ${callId}`,
                referenceType: 'REFUND',
                referenceId: callId,
              },
            ],
          });

          // 9. Update tool call status
          await tx.toolCall.update({
            where: { id: callId },
            data: {
              status: 'REVERSED',
              isReversed: true,
              failureReason: reason,
            },
          });

          // 10. Audit log
          await tx.auditLog.create({
            data: {
              userId,
              action: 'TOOL_CALL_REFUNDED',
              resourceType: 'tool_calls',
              resourceId: callId,
              metadata: {
                amountMicroUsd: call.priceMicroUsd.toString(),
                reason,
              },
            },
          });

          return {
            callId: call.id,
            alreadyRefunded: false,
            status: 'REFUNDED' as const,
            refundedAmountMicroUsd: call.priceMicroUsd.toString(),
            newBalanceMicroUsd: newBalance.toString(),
            message: 'Refund successfully processed and wallet credited',
          };
        });
      } catch (err: any) {
        // If serialization failure code 40001, wait a few ms and retry or check if already completed
        if (err?.code === 'P2010' && err?.meta?.code === '40001' && attempt < 2) {
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    throw new Error('Could not serialize refund transaction after retries');
  }
}
