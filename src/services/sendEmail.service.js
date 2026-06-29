// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const authRepo = require("../repositories/auth.repository");
const reportRepo = require("../repositories/sendEmail.repository");

const { checkCredentials } = require("../config/db");

async function getReleasedChecksByDate(date) {
  return await reportRepo.getReleasedChecks(date);
}

async function postReleaseChecksByDate(date) {
  const pool = require("../config/mysqldb");

  // 1. Fetch released checks from AS400
  const checks = await reportRepo.getReleasedChecks(date);
  if (!checks.length) {
    return { success: true, headersProcessed: 0, detailsProcessed: 0 };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Bulk UPSERT payment_headers (within transaction)
    const upsertedHeaders = await reportRepo.insertPaymentHeaders(checks, date, conn);

    // 3. Fetch detail lines from AS400 for every upserted header SEQUENTIALLY
    //    (ODBC uses a shared singleton connection — parallel calls cause conflicts)
    const allDetailRows = [];
    for (const { check_number, vendor_number, company_number } of upsertedHeaders) {
      const rows = await reportRepo.getPaymentDetailsFromAS400(check_number, vendor_number, company_number);
      allDetailRows.push(...rows);
    }
    console.log(`Fetched ${allDetailRows.length} detail rows from AS400`);

    // 4. Bulk insert payment_details (within transaction)
    await reportRepo.bulkInsertPaymentDetails(allDetailRows, conn);

    // 5. Commit
    await conn.commit();

    console.log(`Headers: ${upsertedHeaders.length}, Details: ${allDetailRows.length}`);

    return {
      success: true,
      headersProcessed: upsertedHeaders.length,
      detailsProcessed: allDetailRows.length,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getReleasedChecksByDate,
  postReleaseChecksByDate
};
