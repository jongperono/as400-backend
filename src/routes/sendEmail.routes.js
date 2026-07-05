const express = require("express");
const router = express.Router();
const sendEmailController = require("../controllers/sendEmail.controller");

router.get("/released-checks", sendEmailController.getReleasedChecks);
router.post("/released-checks", sendEmailController.postReleaseChecks);
router.get("/payment-headers", sendEmailController.getPaymentHeaders);
router.get("/payment-details", sendEmailController.getPaymentDetails);
router.post("/send-notifications", sendEmailController.sendNotifications);
router.post("/resend/:checkNumber", sendEmailController.resendEmail);

module.exports = router;
