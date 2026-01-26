-- ============================================================================
-- WIF Finance - Add Discount Support
-- Migration: 023
-- Description: Add item-level and document-level discount columns
-- ============================================================================

-- Add discount columns to line_items table
-- discount_type: 'fixed' (per unit) or 'percentage' (of line total)
-- discount_value: the discount amount/percentage value
-- discount_amount: calculated discount amount for the line

ALTER TABLE line_items
ADD COLUMN discount_type TEXT CHECK (discount_type IN ('fixed', 'percentage'));

ALTER TABLE line_items
ADD COLUMN discount_value DECIMAL(15,2);

ALTER TABLE line_items
ADD COLUMN discount_amount DECIMAL(15,2);

-- Add document-level discount columns to documents table
-- Applies after subtotal calculation, before tax

ALTER TABLE documents
ADD COLUMN document_discount_type TEXT CHECK (document_discount_type IN ('fixed', 'percentage'));

ALTER TABLE documents
ADD COLUMN document_discount_value DECIMAL(15,2);

ALTER TABLE documents
ADD COLUMN document_discount_amount DECIMAL(15,2);

-- Add comments for documentation
COMMENT ON COLUMN line_items.discount_type IS 'Type of discount: fixed (per unit amount) or percentage (of line gross amount)';
COMMENT ON COLUMN line_items.discount_value IS 'Discount value: amount per unit if fixed, percentage if percentage type';
COMMENT ON COLUMN line_items.discount_amount IS 'Calculated total discount amount for this line item';

COMMENT ON COLUMN documents.document_discount_type IS 'Type of document-level discount: fixed (absolute amount) or percentage (of subtotal)';
COMMENT ON COLUMN documents.document_discount_value IS 'Document discount value: absolute amount if fixed, percentage if percentage type';
COMMENT ON COLUMN documents.document_discount_amount IS 'Calculated document-level discount amount';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
