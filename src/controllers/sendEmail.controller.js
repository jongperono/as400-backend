const reportService = require("../services/sendEmail.service");

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

module.exports = {
  getReleasedChecks,
  postReleaseChecks
};
