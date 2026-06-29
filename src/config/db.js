const odbc = require("odbc");
require("dotenv").config();

let pool;

const connectionString =
  `Driver={${process.env.ODBC_DRIVER}};` +
  `System=${process.env.ODBC_SYSTEM};` +
  `Uid=${process.env.ODBC_UID};` +
  `Pwd=${process.env.ODBC_PWD};`;

async function getConnection() {
  if (!pool) {
    pool = await odbc.connect(connectionString);
    console.log("ODBC connected");
  }
  return pool;
}

async function checkCredentials(username, password) {
  const userConnectionString =
    `Driver={${process.env.ODBC_DRIVER}};` +
    `System=${process.env.ODBC_SYSTEM};` +
    `Uid=${username};` +
    `Pwd=${password};`;

  try {
    const conn = await odbc.connect(userConnectionString);
    await conn.close();
    return true;
  } catch (err) {
    console.error(`ODBC connection verification failed for user "${username}":`, err.message);
    return false;
  }
}

module.exports = { getConnection, checkCredentials };