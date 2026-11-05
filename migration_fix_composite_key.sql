-- ============================================================
-- Migration: Fix composite key for payment_headers and payment_details
-- Date: 2026-11-04
-- Purpose: Support same check_number for different vendors
-- ============================================================

USE as400;

-- Step 1: Drop foreign key constraint on payment_details (if exists)
ALTER TABLE se_payment_details 
DROP FOREIGN KEY IF EXISTS fk_payment_details_header;

-- Step 2: Drop the old unique constraint on payment_headers
ALTER TABLE se_payment_headers 
DROP INDEX IF EXISTS check_number;

-- Step 3: Add email tracking columns to payment_headers
ALTER TABLE se_payment_headers 
ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) NOT NULL DEFAULT 0 AFTER release_date,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP NULL DEFAULT NULL AFTER email_sent;

-- Step 4: Add composite unique key on (check_number, vendor_number)
ALTER TABLE se_payment_headers
ADD UNIQUE KEY uq_check_vendor (check_number, vendor_number);

-- Step 5: Add index for email_sent lookups
ALTER TABLE se_payment_headers
ADD INDEX idx_email_sent (email_sent);

-- Step 6: Update payment_details - ensure vendor_number column exists and is properly ordered
-- (vendor_number should already exist based on schema, but we ensure it's after check_number)
ALTER TABLE se_payment_details
MODIFY COLUMN vendor_number varchar(20) NOT NULL AFTER check_number;

-- Step 7: Add composite unique key on payment_details for (invoice_number, check_number, vendor_number)
-- This prevents duplicate invoice entries per check/vendor combination
ALTER TABLE se_payment_details
DROP INDEX IF EXISTS idx_invoice_number,
DROP INDEX IF EXISTS idx_check_number,
ADD UNIQUE KEY uq_invoice_check_vendor (invoice_number, check_number, vendor_number),
ADD INDEX idx_check_vendor (check_number, vendor_number);

-- ============================================================
-- Verification queries (run after migration)
-- ============================================================

-- Check for duplicate check_number with different vendors (should show counts > 1)
-- SELECT check_number, COUNT(*) as vendor_count, GROUP_CONCAT(vendor_number) as vendors
-- FROM se_payment_headers
-- GROUP BY check_number
-- HAVING COUNT(*) > 1
-- ORDER BY vendor_count DESC;

-- Verify unique constraint
-- SHOW INDEX FROM se_payment_headers WHERE Key_name = 'uq_check_vendor';
-- SHOW INDEX FROM se_payment_details WHERE Key_name = 'uq_invoice_check_vendor';

-- Check email tracking columns
-- SELECT email_sent, email_sent_at, check_number, vendor_number, vendor_name
-- FROM se_payment_headers
-- LIMIT 10;
