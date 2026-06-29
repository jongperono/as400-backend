const pool = require("../config/mysqldb");

async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(sql);

  // Check if we need to migrate email to username
  // try {
  //   const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'email'");
  //   if (columns.length > 0) {
  //     await pool.query("ALTER TABLE users CHANGE COLUMN email username VARCHAR(255) NOT NULL UNIQUE");
  //     console.log("Migrated database: renamed email column to username.");
  //   }
  // } catch (err) {
  //   console.error("Migration error:", err);
  // }
}

// Call initDb on startup
initDb().catch(console.error);

async function createUser(name, username, hashedPassword) {
  const sql = "INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)";
  const [result] = await pool.query(sql, [name, username, hashedPassword]);
  return result;
}

async function getUserByUsername(username) {
  const sql = "SELECT * FROM users WHERE username = ?";
  const [rows] = await pool.query(sql, [username]);
  return rows[0];
}

async function updateUserPassword(username, hashedPassword) {
  const sql = "UPDATE users SET password_hash = ? WHERE username = ?";
  const [result] = await pool.query(sql, [hashedPassword, username]);
  return result;
}

async function getApplicationsByUsername(username) {
  const sql = `
    SELECT DISTINCT
      a.id,
      a.name,
      a.url
    FROM users u
    INNER JOIN user_groups ug
      ON ug.user_id = u.id
    INNER JOIN group_applications gp
      ON gp.group_id = ug.group_id
    INNER JOIN applications a
      ON a.id = gp.application_id
    WHERE u.username = ?
    ORDER BY a.name
    `
  const [rows] = await pool.query(sql, [username]);
  return rows;
}

module.exports = {
  createUser,
  getUserByUsername,
  updateUserPassword,
  getApplicationsByUsername
};
