-- Migration: Add allow_negative_balance setting to companies
-- This allows companies to enable overdraft/negative balances in accounts

-- Add the setting column
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS allow_negative_balance BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN companies.allow_negative_balance IS 'Allow accounts to have negative balances (overdraft). When FALSE, payments that would result in negative balance are blocked.';

-- Update existing companies to have the default setting
UPDATE companies
SET allow_negative_balance = FALSE
WHERE allow_negative_balance IS NULL;
