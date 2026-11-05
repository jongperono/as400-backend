# API Changes - Composite Key Implementation

## Summary of Changes

All API endpoints remain the same, but the **internal data model** now uses composite keys `(check_number, vendor_number)` instead of just `check_number`.

## Endpoints (No Changes to URLs)

### 1. Generate Email List

**POST** `/send-email/released-checks`

**Request:**

```json
{
  "date": "11/4/2026"
}
```

**Response:** (No change)

```json
{
  "success": true,
  "headersProcessed": 150,
  "detailsProcessed": 1250
}
```

**Behavior Change:**

- ✅ Now supports multiple vendors with same check_number
- ✅ Creates separate header rows for each vendor/check combination
- ✅ No more overwriting when duplicate check_numbers appear

### 2. Get Payment Headers

**GET** `/send-email/payment-headers?page=1&limit=10&search=123`

**Response Changes:**

```json
{
  "rows": [
    {
      "id": 1,
      "check_number": "12345",
      "vendor_number": "100001", // Key part of composite
      "vendor_name": "ABC Corp",
      "company_number": "01",
      "company_name": "NCCC Main",
      "email_address": "vendor@abc.com",
      "total_amount": 50000.0,
      "bank_account": 1001,
      "release_date": "2026-11-04",
      "email_sent": 0, // NEW: Email status
      "email_sent_at": null, // NEW: When email was sent
      "created_at": "2026-11-04T10:00:00Z",
      "updated_at": "2026-11-04T10:00:00Z"
    },
    {
      "id": 2,
      "check_number": "12345", // Same check number...
      "vendor_number": "200002", // ...different vendor!
      "vendor_name": "XYZ Ltd",
      "company_number": "02",
      "company_name": "NCCC Branch",
      "email_address": "billing@xyz.com",
      "total_amount": 35000.0,
      "bank_account": 1002,
      "release_date": "2026-11-04",
      "email_sent": 1,
      "email_sent_at": "2026-11-04T11:30:00Z",
      "created_at": "2026-11-04T10:00:00Z",
      "updated_at": "2026-11-04T11:30:00Z"
    }
  ],
  "total": 150
}
```

**Key Changes:**

- ✅ Same check_number can appear multiple times with different vendor_number
- ✅ New fields: `email_sent` (0/1) and `email_sent_at` (timestamp)

### 3. Get Payment Details

**GET** `/send-email/payment-details?page=1&limit=10&search=12345`

**Response:** (Structure unchanged, but data is properly associated)

```json
{
  "rows": [
    {
      "id": 1,
      "invoice_date": "2026-10-15",
      "invoice_number": "INV-001",
      "check_number": "12345",
      "vendor_number": "100001", // Properly linked to specific vendor
      "company_number": "01",
      "store_name": "Main Store",
      "total_net": 25000.0,
      "rebate_type": "Volume",
      "po_number": "PO-12345",
      "created_at": "2026-11-04T10:00:00Z"
    }
  ],
  "total": 45
}
```

**Key Changes:**

- ✅ Details are now correctly linked to specific vendor/check combinations
- ✅ No more mixed details from different vendors

### 4. Send Email Notifications

**POST** `/send-email/send-notifications`

**Request:**

```json
{
  "date": "2026-11-04"
}
```

**Response:** (Enhanced logging)

```json
{
  "total": 150,
  "sent": 120,
  "skipped": 10,
  "failed": 5,
  "logs": [
    "[SENT] Vendor ABC Corp (100001) → vendor@abc.com — 3 check(s) [msgId: <abc123@mail>]",
    "[SENT] Vendor XYZ Ltd (200002) → billing@xyz.com — 2 check(s) [msgId: <xyz456@mail>]",
    "[SKIP] Vendor No Email Inc (300003) — no email address",
    "[FAIL] Vendor Bad Email (400004) → bad@example — SMTP timeout",
    "─── Summary: 120 sent, 10 skipped, 5 failed out of 150 headers ───"
  ]
}
```

**Behavior Changes:**

- ✅ Groups checks by vendor (one email per vendor with all their checks)
- ✅ Handles same check_number for different vendors correctly
- ✅ Updates `email_sent` and `email_sent_at` for each vendor/check combination
- ✅ Enhanced logging shows check count per vendor

### 5. Resend Email

**POST** `/send-email/resend/:checkNumber/:vendorNumber`

**Request:**

```
POST /send-email/resend/12345/100001
```

**Response:**

```json
{
  "ok": true,
  "message": "Email sent to ABC Corp (100001) at vendor@abc.com [msgId: <abc@mail>]"
}
```

**Behavior Changes:**

- ✅ Now requires BOTH check_number AND vendor_number in URL
- ✅ Sends email to **specific vendor only** (not all vendors with that check number)
- ✅ More precise control - each check/vendor combination can be resent independently
- ✅ Updates `email_sent` flag only for the specific vendor/check combination

## Frontend Impact

### Display Changes Needed

**Payment Headers Table:**

- Show both `check_number` and `vendor_number` columns
- Display `email_sent` status badge (Sent/Pending)
- Show `email_sent_at` timestamp when available
- Highlight duplicate check_numbers with different vendors

**Search/Filter:**

- Can search by check_number (will return all vendors)
- Can search by vendor_number (will return all checks for that vendor)
- Can search by vendor_name

**Resend Button:**

- Clicking "Resend" on a check will send to **all vendors** with that check number
- Show toast notification indicating how many vendors received the email

## Migration Required

**Before deploying code changes, run:**

```bash
mysql -u root -p -P 3307 < migration_fix_composite_key.sql
```

This will:

1. Update database schema to use composite keys
2. Add email tracking columns
3. Update indexes for performance

## Breaking Changes

### None for API consumers!

All endpoints maintain backward compatibility. The changes are internal:

- Data model now properly supports same check for different vendors
- Email tracking is more accurate
- No API contract changes

## Testing Scenarios

### Scenario 1: Duplicate Check Numbers

```
Check #12345, Vendor A → Header ID 1
Check #12345, Vendor B → Header ID 2  ✅ Both created (not overwritten)
```

### Scenario 2: Email Sending

```
Date: 2026-11-04
- Vendor A has checks: 12345, 67890
- Vendor B has checks: 12345, 99999

Result:
- Vendor A receives 1 email with 2 checks
- Vendor B receives 1 email with 2 checks
- Check 12345 appears in both emails (correctly)
```

### Scenario 3: Resending

```
User searches for check "12345"
Results show:
- Row 1: Check 12345, Vendor 100001 (ABC Corp)
- Row 2: Check 12345, Vendor 200002 (XYZ Ltd)

User clicks "Resend" on Row 1 (ABC Corp)

Result:
- POST /send-email/resend/12345/100001
- Email sent ONLY to Vendor ABC Corp (100001)
- Vendor XYZ Ltd (200002) is NOT affected
- Only Row 1's email_sent flag is updated
```

## Questions?

Refer to `COMPOSITE_KEY_FIX_README.md` for detailed implementation details.
