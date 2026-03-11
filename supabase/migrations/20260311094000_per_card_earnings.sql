-- Migration: Change from daily payout to per-card earnings model
-- This changes how iOS users are compensated from a flat daily rate to per-card earnings

-- 1. Rename the column in platform_settings
ALTER TABLE public.platform_settings
  RENAME COLUMN ios_user_daily_payout TO earnings_per_card;

-- 2. Update default values for the new model
-- Default: N250 per card, 5-10 cards per day = N1,250-N2,500
UPDATE public.platform_settings SET
  earnings_per_card = 250,
  min_daily_transactions = 5,
  max_daily_transactions = 10
WHERE id = 1;

-- 3. Add card_count column to transactions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'card_count'
  ) THEN
    ALTER TABLE public.transactions
      ADD COLUMN card_count INTEGER NOT NULL DEFAULT 1;

    -- Add a comment explaining the field
    COMMENT ON COLUMN public.transactions.card_count IS
      'Number of gift cards in this transaction. Each card earns the per-card rate.';
  END IF;
END $$;

-- 4. Update existing transactions to use receipt_count as card_count if they have a value
UPDATE public.transactions
SET card_count = receipt_count
WHERE receipt_count > 0 AND card_count = 1;
