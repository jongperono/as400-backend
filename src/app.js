const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user.routes");
const authRoutes = require("./routes/auth.routes");
const sendEmailRoutes = require("./routes/sendEmail.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/send-email", sendEmailRoutes);

module.exports = app;