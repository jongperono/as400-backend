const pool = require("../config/mysqldb");
const { getConnection } = require("../config/db");

function formatToMySQLDate(date) {
  const [month, day, year] = date.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Convert an AS400 date value to MySQL YYYY-MM-DD string.
 * AS400 SQL may return dates as:
 *   - JS Date object  → use toISOString
 *   - '2026-06-25'    → already ISO, pass through
 *   - '20260625'      → packed YYYYMMDD
 *   - 1260625         → numeric YYYYMMDD (century dropped) — treat as 2000s
 */
function formatAS400Date(value) {
  if (!value) return null;
  // Already a JS Date
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  // Packed YYYYMMDD (8 digits)
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // 7-digit cYYMMDD (IBM legacy)
  if (/^\d{7}$/.test(s)) {
    const century = s[0] === '1' ? '20' : '19';
    return `${century}${s.slice(1, 3)}-${s.slice(3, 5)}-${s.slice(5, 7)}`;
  }
  // Fallback — return null to avoid MySQL rejecting a bad date
  console.warn('formatAS400Date: unrecognised date value:', value);
  return null;
}

async function getReleasedChecks(releasedDate) {
  const sql = `
    SELECT
      DISTINCT A.AICMP,
      D.GLCNAM,
      A.AINUM,
      C.AAEMAL,
      A.AICHQ,
      E.VENDOR_NAME,
      A.AIBKN,
      E.TOTAL_AMOUNT
    FROM MMLTSLIB.APHIST A
    INNER JOIN MMLTSLIB.APADDR C
      ON C.AANUM = A.AINUM
      AND C.AATYPE = '8'
    INNER JOIN MMLTSLIB.GLCNTL D
      ON D.GLCMPN = A.AICMP
    INNER JOIN RCCLIB.TBL_CHECK_PRINT_CONTROL E
      ON CAST(E.CHECK_NUMBER AS VARCHAR(10))
         = CAST(A.AICHQ AS VARCHAR(10))
      AND E.VENDORID = A.AINUM
    WHERE
      E.RELEASED_DATE LIKE ?
      AND C.AAEMAL <> ''
      AND E.TOTAL_AMOUNT > 0
      AND A.AINUM NOT IN (
        306915,
        220313,
        310185,
        324803,
        323076,
        309253
      )
    GROUP BY
      A.AICMP,
      A.AINUM,
      D.GLCNAM,
      C.AAEMAL,
      A.AICHQ,
      E.VENDOR_NAME,
      E.TOTAL_AMOUNT,
      E.NBU_CODE,
      A.AIBKN
  `;

  const conn = await getConnection();

  try {
    const result = await conn.query(sql, [
      `${releasedDate}%`,
    ]);

    return result;
  } finally {
    console.log('close')
    // await conn.close();
  }
}
async function insertPaymentHeaders(rows, releasedDate, db = pool) {
  if (!rows.length) {
    return [];
  }
  const mysqlDate = formatToMySQLDate(releasedDate);
  console.log(mysqlDate, 'mysqlDate');

  const sql = `
    INSERT INTO se_payment_headers (
      company_number,
      company_name,
      vendor_number,
      vendor_name,
      email_address,
      check_number,
      total_amount,
      bank_account,
      release_date
    )
    VALUES ?
    ON DUPLICATE KEY UPDATE
      company_name   = VALUES(company_name),
      vendor_name    = VALUES(vendor_name),
      email_address  = VALUES(email_address),
      total_amount   = VALUES(total_amount),
      release_date   = VALUES(release_date)
  `;

  const values = rows.map((row) => [
    row.AICMP,
    row.GLCNAM.trim(),
    row.AINUM,
    row.VENDOR_NAME.trim(),
    row.AAEMAL.trim(),
    row.AICHQ,
    row.TOTAL_AMOUNT,
    row.AIBKN,
    mysqlDate,
  ]);

  await db.query(sql, [values]);

  // Return the list of upserted check keys so we can fetch details per check
  return rows.map((row) => ({
    check_number: String(row.AICHQ).trim(),
    vendor_number: String(row.AINUM).trim(),
    company_number: String(row.AICMP).trim(),
  }));
}

/**
 * Fetch payment detail lines from AS400 for a single check.
 * Uses the shared singleton ODBC connection — callers must NOT run these in parallel.
 */
async function getPaymentDetailsFromAS400(checkNumber, vendorNumber, companyNumber) {
  console.log(checkNumber, vendorNumber, companyNumber, 'checkNumber vendorNumber companyNumber');
  const sql = `
    SELECT
      RTRIM(CHAR(A.AIDTIV))  AS AIDTIV,
      A.AIINV,
      E.AIPO,
      A.AICHQ,
      C.STRNAM,
      D.REBATP,
      ROUND(A.AITONT, 2) AS AITONT,
      A.AICMP,
      A.AINUM
    FROM MMLTSLIB.APHIST A
    LEFT JOIN MMLTSLIB.REBALH B
      ON A.AINUM = B.REHVEN
      AND CAST(SUBSTRING(A.AIINV, 1, 6) AS NUMERIC) = CAST(B.REHVRF AS NUMERIC)
      AND A.AINOTE LIKE 'Reb%'
    INNER JOIN MMLTSLIB.TBLSTR C
      ON A.AISTR = C.STRNUM
    LEFT JOIN MMLTSLIB.REBALT D
      ON B.REHTYP = D.REBATP
    LEFT JOIN MMLTSLIB.APASRC E
      ON A.AINUM = E.AINUM
      AND A.AIINV = E.AIINV
    WHERE
      A.AICHQ  = TRIM(CAST(? AS CHAR(20)))
      AND A.AINUM = TRIM(CAST(? AS CHAR(20)))
      AND A.AICMP = TRIM(CAST(? AS CHAR(20)))
  `;

  // Reuse the shared singleton — do NOT call in parallel
  const conn = await getConnection();
  const result = await conn.query(sql, [
    String(checkNumber).trim(),
    String(vendorNumber).trim(),
    String(companyNumber).trim(),
  ]);
  console.log(result, 'result');
  return result;
}

/**
 * Bulk-insert payment detail rows into MySQL.
 * Uses INSERT IGNORE so duplicate (invoice_number + check_number) rows are skipped.
 */
async function bulkInsertPaymentDetails(detailRows, db = pool) {
  if (!detailRows.length) {
    console.log('bulkInsertPaymentDetails: no rows to insert');
    return;
  }

  const sql = `
    INSERT IGNORE INTO se_payment_details (
      invoice_date,
      invoice_number,
      check_number,
      store_name,
      total_net,
      company_number,
      vendor_number
    )
    VALUES ?
  `;

  const values = detailRows.map((row) => [
    formatAS400Date(row.AIDTIV),
    row.AIINV ? String(row.AIINV).trim() : null,
    row.AICHQ ? String(row.AICHQ).trim() : null,
    row.STRNAM ? String(row.STRNAM).trim() : null,
    row.AITONT ?? 0,
    row.AICMP ? String(row.AICMP).trim() : null,
    row.AINUM ? String(row.AINUM).trim() : null,
  ]);

  const [result] = await db.query(sql, [values]);
  console.log(`bulkInsertPaymentDetails: ${result.affectedRows} rows inserted`);
}

async function getPaymentHeaders({ search = "", page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  let countSql = `SELECT COUNT(*) AS total FROM se_payment_headers`;
  let dataSql = `SELECT * FROM se_payment_headers`;
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;
    const filter = ` WHERE check_number LIKE ? OR vendor_number LIKE ? OR vendor_name LIKE ? OR company_number LIKE ? OR company_name LIKE ?`;
    countSql += filter;
    dataSql += filter;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  dataSql += ` ORDER BY release_date DESC, id DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, parseInt(limit), parseInt(offset)];

  const [[{ total }]] = await pool.query(countSql, params);
  const [rows] = await pool.query(dataSql, dataParams);

  return { rows, total };
}

async function getPaymentDetails({ search = "", page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  let countSql = `SELECT COUNT(*) AS total FROM se_payment_details`;
  let dataSql = `SELECT * FROM se_payment_details`;
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;
    const filter = ` WHERE check_number LIKE ? OR invoice_number LIKE ? OR store_name LIKE ? OR company_number LIKE ? OR vendor_number LIKE ?`;
    countSql += filter;
    dataSql += filter;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  dataSql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, parseInt(limit), parseInt(offset)];

  const [[{ total }]] = await pool.query(countSql, params);
  const [rows] = await pool.query(dataSql, dataParams);

  return { rows, total };
}

module.exports = {
  getReleasedChecks,
  insertPaymentHeaders,
  getPaymentDetailsFromAS400,
  bulkInsertPaymentDetails,
  getPaymentHeaders,
  getPaymentDetails,
};
