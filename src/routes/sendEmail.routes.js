const express = require("express");
const router = express.Router();
const sendEmailController = require("../controllers/sendEmail.controller");

router.get("/released-checks", sendEmailController.getReleasedChecks);
router.post("/released-checks", sendEmailController.postReleaseChecks);

module.exports = router;
