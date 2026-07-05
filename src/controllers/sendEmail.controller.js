const reportService = require("../services/sendEmail.service");
const emailService = require("../services/email.service");

async function getReleasedChecks(req, res) {
  console.log('getReleasedChecks')
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: "Date is required",
      });
    }

    const data =
      await reportService.getReleasedChecksByDate(
        date
      );
    console.log(data.length, 'released checks')
    res.json(data);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function postReleaseChecks(req, res) {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        error: "Date is required",
      });
    }

    const data = await reportService.postReleaseChecksByDate(date);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
}

async function getPaymentHeaders(req, res) {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const data = await reportService.getPaymentHeaders({
      search,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function getPaymentDetails(req, res) {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const data = await reportService.getPaymentDetails({
      search,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function sendNotifications(req, res) {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }
    const result = await emailService.sendVendorPaymentEmails(date);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function resendEmail(req, res) {
  try {
    const { checkNumber } = req.params;
    if (!checkNumber) {
      return res.status(400).json({ error: "checkNumber is required" });
    }
    const result = await emailService.resendCheckEmail(checkNumber);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getReleasedChecks,
  postReleaseChecks,
  getPaymentHeaders,
  getPaymentDetails,
  sendNotifications,
  resendEmail,
};
