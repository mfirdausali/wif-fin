-- ============================================================================
-- WIF Finance - Add Cost Center to Documents
-- Migration: 006
-- Description: Link documents to cost centers for profit/loss tracking
-- ============================================================================

-- Add cost_center_id column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_documents_cost_center ON documents(cost_center_id);

-- Comment for documentation
COMMENT ON COLUMN documents.cost_center_id IS 'Links document to a cost center (trip/project) for profit/loss tracking';
