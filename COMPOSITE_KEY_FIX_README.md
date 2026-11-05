# Composite Key Fix for Payment Headers & Details

## Problem Summary

The original implementation treated `check_number` as the unique key for `se_payment_headers`, but the business logic requires supporting the **same check number for different vendors**. This caused:

1. **Data Loss**: When the same check_number appeared for different vendors, the system would overwrite the existing header instead of creating a new entry
2. **Incorrect Email Grouping**: Emails were not properly grouped by vendor_id and check_number combination
3. **Foreign Key Issues**: The relationship between headers and details couldn't properly represent multiple vendors per check

## Solution

Changed the unique constraint from `check_number` alone to a **composite key of `(check_number, vendor_number)`**.

## Changes Made

### 1. Database Schema Updates

**File: `mysql.txt`**
- Updated `se_payment_headers` table definition:
  - Changed `UNIQUE KEY check_number (check_number)` to `UNIQUE KEY uq_check_vendor (check_number, vendor_number)`
  - Added `email_sent TINYINT(1)` and `email_sent_at TIMESTAMP` columns for tracking
  - Added index on `email_sent` for efficient queries

- Updated `se_payment_details` table definition:
  - Added composite unique key `uq_invoice_check_vendor (invoice_number, check_number, vendor_number)`
  - Removed old foreign key constraint (not compatible with composite key)
  - Updated indexes to use `idx_check_vendor (check_number, vendor_number)`

### 2. Migration SQL Script

**File: `migration_fix_composite_key.sql`**

A complete migration script that:
1. Drops the old single-column unique constraint
2. Adds the new composite unique key
3. Adds email tracking columns
4. Updates indexes
5. Includes verification queries

**To Apply Migration:**
```bash
mysql -u root -p -P 3307 < migration_fix_composite_key.sql
```

### 3. Repository Updates

**File: `src/repositories/sendEmail.repository.js`**

- **`insertPaymentHeaders()`**: 
  - Updated `ON DUPLICATE KEY UPDATE` logic to work with composite key `(check_number, vendor_number)`
  - Now properly upserts based on both fields, preventing overwrites when same check has different vendors

- **`getPaymentHeaders()`**:
  - Added `email_sent` and `email_sent_at` columns to SELECT statement
  - Returns proper status for each check/vendor combination

### 4. Email Service Updates

**File: `src/services/email.service.js`**

- **`sendVendorPaymentEmails()`**:
  - Changed from using `status` column to `email_sent` flag
  - Updated queries to use composite key for marking records as sent
  - Groups emails by vendor properly (one email per vendor with all their checks)
  - Updates `email_sent = 1` and `email_sent_at = NOW()` for each check/vendor combination

- **`resendCheckEmail()`**:
  - Now handles cases where same check_number has multiple vendors
  - Sends emails to all vendors associated with a check number
  - Updates each vendor's record individually using composite key

## How It Works Now

### Data Flow

1. **Generate Email List** (POST `/send-email/released-checks`):
   ```
   AS400 Query → Returns checks (possibly same check_number for different vendors)
   ↓
   insertPaymentHeaders() → Upserts based on (check_number, vendor_number)
   ↓
   Each vendor gets their own header row, even if check_number is duplicated
   ```

2. **Send Notifications** (POST `/send-email/send-notifications`):
   ```
   Fetch headers WHERE email_sent = 0
   ↓
   Group by vendor_number (one email per vendor)
   ↓
   For each vendor:
     - Fetch all their checks (using composite key)
     - Fetch details for each check (using check_number + vendor_number + company_number)
     - Build HTML email with all checks
     - Send email
     - Update email_sent = 1 for all that vendor's checks
   ```

3. **Resend Email** (POST `/send-email/resend/:checkNumber`):
   ```
   Find all headers with check_number = :checkNumber
   ↓
   For each vendor found:
     - Fetch their specific details
     - Send individual email
     - Update their email_sent flag
   ```

## Key Benefits

1. ✅ **No Data Overwriting**: Same check number can exist for multiple vendors
2. ✅ **Proper Email Grouping**: Each vendor gets one email with all their checks
3. ✅ **Accurate Tracking**: Email sent status tracked per vendor/check combination
4. ✅ **Data Integrity**: Composite keys prevent duplicate combinations
5. ✅ **Flexible Resending**: Can resend to specific vendor or all vendors for a check

## Testing Checklist

After applying the migration, test:

- [ ] Generate email list with checks that have same number but different vendors
- [ ] Verify both headers are inserted (not overwritten)
- [ ] View Payment Headers tab - see multiple rows with same check_number but different vendor_number
- [ ] View Payment Details tab - details are correctly associated with each vendor
- [ ] Send notifications - each vendor receives their own email
- [ ] Resend function works for checks with multiple vendors
- [ ] Search functionality works across check_number and vendor_number

## Rollback Plan

If issues arise, you can rollback the schema changes:

```sql
-- Drop composite key
ALTER TABLE se_payment_headers DROP INDEX uq_check_vendor;

-- Restore single column unique key (WARNING: will fail if duplicates exist)
ALTER TABLE se_payment_headers ADD UNIQUE KEY check_number (check_number);

-- Remove email tracking columns
ALTER TABLE se_payment_headers 
  DROP COLUMN email_sent,
  DROP COLUMN email_sent_at;
```

⚠️ **Note**: Rollback will only work if you don't have duplicate check_numbers with different vendors. Clean data first if needed.

## Database Schema Reference

### New Composite Keys

**se_payment_headers:**
- Primary: `id` (auto increment)
- Unique: `(check_number, vendor_number)` ← NEW COMPOSITE KEY

**se_payment_details:**
- Primary: `id` (auto increment)
- Unique: `(invoice_number, check_number, vendor_number)` ← COMPOSITE KEY

### Email Tracking Columns

**se_payment_headers:**
- `email_sent`: TINYINT(1) - 0 = not sent, 1 = sent
- `email_sent_at`: TIMESTAMP - when email was sent

## Support

For questions or issues:
1. Check the migration log after running the script
2. Review verification queries in `migration_fix_composite_key.sql`
3. Check application logs for any SQL errors after deployment
