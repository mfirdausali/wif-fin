-- ============================================================================
-- WIF Finance - Add Operations Role
-- Migration: 015
-- Description: Add 'operations' role to the users table CHECK constraint
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the updated constraint with 'operations' role included
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'accountant', 'viewer', 'operations'));

-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role: admin, manager, accountant, viewer, or operations. Operations role has access to Payment Vouchers and Bookings only.';
