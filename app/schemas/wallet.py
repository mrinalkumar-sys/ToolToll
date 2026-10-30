from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.wallet import LedgerType
from app.models.payment import TopupStatus, PayoutStatus


class WalletResponse(BaseModel):
    id: str
    user_id: str
    balance: Decimal
    reserved_balance: Decimal
    available_balance: Decimal
    currency: str
    updated_at: datetime

    class Config:
        from_attributes = True


class TopupCreateRequest(BaseModel):
    amount: Decimal = Field(ge=5, le=1000, description="Amount in USD to top up (between 5 and 1000)")
    payment_provider: str = Field(default="paypal", description="'paypal' or 'mock'")


class TopupResponse(BaseModel):
    topup_id: str
    amount: Decimal
    currency: str
    status: TopupStatus
    order_id: Optional[str] = None
    approval_url: Optional[str] = None


class PayPalOrderCreateResponse(BaseModel):
    order_id: str
    status: str
    approval_url: Optional[str] = None


class PayPalCaptureRequest(BaseModel):
    order_id: str


class LedgerEntryResponse(BaseModel):
    id: str
    wallet_id: str
    type: LedgerType
    amount: Decimal
    balance_after: Decimal
    reference_id: Optional[str]
    reference_type: Optional[str]
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


class PayoutCreateRequest(BaseModel):
    amount: Decimal = Field(ge=5, description="Payout amount requested")
    payout_destination: str = Field(description="PayPal email or bank account destination")
    payout_provider: str = Field(default="mock", description="'paypal' or 'mock'")


class PayoutResponse(BaseModel):
    id: str
    creator_id: str
    amount: Decimal
    currency: str
    payout_provider: str
    payout_destination: str
    status: PayoutStatus
    created_at: datetime

    class Config:
        from_attributes = True


class CreatorEarningsSummary(BaseModel):
    gross_earnings: Decimal
    platform_fees: Decimal
    net_earnings: Decimal
    total_calls: int
    pending_payouts: Decimal
