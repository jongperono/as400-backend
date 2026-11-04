const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const sendEmailController = require("../controllers/sendEmail.controller");

// All email routes require authentication
router.get("/released-checks", authenticateToken, sendEmailController.getReleasedChecks);
router.post("/released-checks", authenticateToken, sendEmailController.postReleaseChecks);
router.get("/payment-headers", authenticateToken, sendEmailController.getPaymentHeaders);
router.get("/payment-details", authenticateToken, sendEmailController.getPaymentDetails);
router.post("/send-notifications", authenticateToken, sendEmailController.sendNotifications);
router.post("/resend/:checkNumber", authenticateToken, sendEmailController.resendEmail);

module.exports = router;
