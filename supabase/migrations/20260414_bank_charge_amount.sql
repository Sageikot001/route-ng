-- Add bank_charge_amount field to transactions
-- This tracks what the bank actually charged (typically slightly higher than card_amount)
-- Used for cost analysis and profit margin calculations

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS bank_charge_amount DECIMAL(10, 2);

-- Add comment
COMMENT ON COLUMN transactions.bank_charge_amount IS 'The amount the bank charged for this transaction (may differ from card_amount due to fees)';
