const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");

const userController = require("../controllers/user.controller");

// Protected route - requires authentication
router.get("/", authenticateToken, userController.getUsers);
// router.get("/:id", userController.getUser);
// router.post("/", userController.createUser);

module.exports = router;