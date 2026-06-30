/**
 * email.service.js
 * Vendor Payment Notification Email System
 *
 * - Ensures se_payment_headers has status/sent_at/error_log columns
 * - Groups pending headers by vendor
 * - Builds HTML email per vendor (all checks + grand total)
 * - Sends via nodemailer SMTP
 * - Updates status/sent_at/error_log per header
 */

const nodemailer = require("nodemailer");
const pool = require("../config/mysqldb");

// ─── DB Schema Migration ──────────────────────────────────────────────────────

// async function ensureEmailColumns() {
//     const alterStatements = [
//         // `ALTER TABLE se_payment_headers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'`,
//         // `ALTER TABLE se_payment_headers ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP NULL DEFAULT NULL`,
//         `ALTER TABLE se_payment_headers ADD COLUMN IF NOT EXISTS error_log TEXT NULL`,
//     ];
//     for (const sql of alterStatements) {
//         await pool.query(sql);
//     }
// }

// ─── SMTP Transporter ────────────────────────────────────────────────────────

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: parseInt(process.env.SMTP_PORT || "587") === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

// ─── HTML Email Builder ───────────────────────────────────────────────────────

function buildEmailHtml({ vendorName, vendorNumber, checks }) {
    const formatCurrency = (v) =>
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(v) || 0);

    const formatDate = (d) => {
        if (!d) return "—";
        try { return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
        catch { return d; }
    };

    const grandTotal = checks.reduce((sum, c) => sum + Number(c.total_amount || 0), 0);

    const checkRows = checks.map((c) => {
        const detailRows = (c.details || []).map((d) => `
      <tr>
        <td style="padding:8px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.invoice_number || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.store_name || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">${formatDate(d.invoice_date)}</td>
        <td style="padding:8px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.po_number || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;">
          ${d.rebate_type
                ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#f3e8ff;color:#7c3aed;font-size:11px;font-weight:600;">${d.rebate_type}</span>`
                : `<span style="color:#cbd5e1;">—</span>`
            }
        </td>
        <td style="padding:8px 12px;font-size:12px;color:#1e293b;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;">${formatCurrency(d.total_net)}</td>
      </tr>`).join("");

        return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:#f8fafc;padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:13px;font-weight:700;color:#0f172a;">Check #${c.check_number}</span>
          <span style="margin-left:12px;font-size:11px;color:#64748b;font-family:monospace;">Bank: ${c.bank_account || "—"}</span>
        </div>
        <span style="font-size:13px;font-weight:700;color:#2563eb;">${formatCurrency(c.total_amount)}</span>
      </div>
      ${detailRows ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;text-align:left;">Invoice #</th>
            <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;text-align:left;">Store</th>
            <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;text-align:left;">Invoice Date</th>
            <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;text-align:left;">PO Number</th>
            <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;text-align:left;">Rebate Type</th>
            <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;text-align:right;">Net Amount</th>
          </tr>
        </thead>
        <tbody>${detailRows}</tbody>
      </table>` : `<p style="padding:12px 18px;font-size:12px;color:#94a3b8;">No detail lines available.</p>`}
    </div>`;
    }).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#93c5fd;font-weight:600;">Vendor Payment Notification</p>
      <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">${vendorName}</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#bfdbfe;font-family:monospace;">Vendor ID: ${vendorNumber}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 36px;">
      <p style="font-size:14px;color:#475569;margin:0 0 20px;">Dear Valued Vendor,</p>
      <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;">
        Please find below the summary of payment(s) released for your account. 
        Each check is listed with its corresponding invoice lines for your reference.
      </p>

      ${checkRows}

      <!-- Grand Total -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span style="font-size:14px;font-weight:700;color:#1e3a5f;">Total Payment Amount</span>
        <span style="font-size:20px;font-weight:800;color:#1d4ed8;">${formatCurrency(grandTotal)}</span>
      </div>

      <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;line-height:1.6;">
        This is an automated notification. Please do not reply to this email.<br/>
        For inquiries, contact your Accounts Payable representative.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} AS400 Payment Portal · Automated Notification System</p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Main Send Function ───────────────────────────────────────────────────────

/**
 * sendVendorPaymentEmails
 * @param {string} date  Release date in YYYY-MM-DD format
 * @returns {{ total, sent, skipped, failed, logs }}
 */
async function sendVendorPaymentEmails(date) {
    // await ensureEmailColumns();

    // 1. Fetch pending headers for the given date
    const [headers] = await pool.query(
        `SELECT * FROM se_payment_headers WHERE release_date = ? AND status = 'pending' ORDER BY vendor_number`,
        [date]
    );

    if (!headers.length) {
        return { total: 0, sent: 0, skipped: 0, failed: 0, logs: [`No pending headers found for ${date}`] };
    }

    // 2. Group headers by vendor_number
    const vendorMap = new Map();
    for (const h of headers) {
        const key = `${h.vendor_number}`;
        if (!vendorMap.has(key)) {
            vendorMap.set(key, { vendorNumber: h.vendor_number, vendorName: h.vendor_name, email: h.email_address, checks: [] });
        }
        vendorMap.get(key).checks.push(h);
    }

    const logs = [];
    let sent = 0, skipped = 0, failed = 0;
    const transporter = createTransporter();
    const checkNumbersToUpdate = [];

    // 3. Process each vendor sequentially
    for (const [, vendor] of vendorMap) {
        const { vendorNumber, vendorName, email, checks } = vendor;

        if (!email) {
            skipped++;
            logs.push(`[SKIP] Vendor ${vendorName} (${vendorNumber}) — no email address`);
            await pool.query(
                `UPDATE se_payment_headers SET status='skipped', error_log='No email address' WHERE vendor_number=? AND release_date=?`,
                [vendorNumber, date]
            );
            continue;
        }

        // 4. Fetch detail lines for each check in this vendor batch
        for (const check of checks) {
            const [details] = await pool.query(
                `SELECT * FROM se_payment_details WHERE check_number=? AND vendor_number=? AND company_number=?`,
                [check.check_number, check.vendor_number, check.company_number]
            );
            check.details = details;
        }

        const html = buildEmailHtml({ vendorName, vendorNumber, checks });

        try {
            const info = await transporter.sendMail({
                from: `"Payment Notifications" <${process.env.SMTP_FROM}>`,
                to: email,
                subject: `Payment Notification — ${vendorName}`,
                html,
            });

            sent++;
            logs.push(`[SENT] Vendor ${vendorName} (${vendorNumber}) → ${email} [msgId: ${info.messageId}]`);

            await pool.query(
                `UPDATE se_payment_headers SET status='sent', emailed_at=NOW(), error_log=NULL WHERE vendor_number=? AND release_date=?`,
                [vendorNumber, date]
            );
        } catch (err) {
            failed++;
            const errMsg = err.message || String(err);
            logs.push(`[FAIL] Vendor ${vendorName} (${vendorNumber}) → ${email} — ${errMsg}`);

            await pool.query(
                `UPDATE se_payment_headers SET status='failed', error_log=? WHERE vendor_number=? AND release_date=?`,
                [errMsg.slice(0, 1000), vendorNumber, date]
            );
        }
    }

    logs.push(`─── Summary: ${sent} sent, ${skipped} skipped, ${failed} failed out of ${headers.length} headers ───`);

    return { total: headers.length, sent, skipped, failed, logs };
}

module.exports = { sendVendorPaymentEmails };
