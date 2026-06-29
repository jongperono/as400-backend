const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authRepo = require("../repositories/auth.repository");
const { checkCredentials } = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey_change_in_production";

async function signup({ name, username, password }) {
  // Check if user already exists
  const existingUser = await authRepo.getUserByUsername(username);
  if (existingUser) {
    throw new Error("User with this username already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Save user
  const result = await authRepo.createUser(name, username, hashedPassword);

  // Generate token
  const token = jwt.sign({ id: result.insertId, username }, JWT_SECRET, {
    expiresIn: "1h",
  });

  return {
    user: { id: result.insertId, name, username },
    token,
  };
}

async function login({ username, password }) {
  // Verify user credentials in AS400 via ODBC
  const isValid = await checkCredentials(username, password);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  // Hash password using bcrypt
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Check if user exists in the MySQL db
  const user = await authRepo.getUserByUsername(username);
  if (!user) {
    // Write new user to MySQL
    await authRepo.createUser(username, username, hashedPassword);
    console.log(`Synchronized new user "${username}" to MySQL database.`);
  } else {
    // Update existing user's password
    await authRepo.updateUserPassword(username, hashedPassword);
    console.log(`Updated password for existing user "${username}" in MySQL database.`);
  }

  // Get application list
  const applications =
    await authRepo.getApplicationsByUsername(username);
  // Generate token
  const token = jwt.sign({ username }, JWT_SECRET, {
    expiresIn: "1h",
  });
  console.log(username, applications, token)
  return {
    user: { username },
    applications,
    token
  };
}

module.exports = {
  signup,
  login,
};
