const pool = require("./config/mysqldb");

async function test() {
  const [rows] = await pool.query("SELECT * FROM USERS");
  console.log(rows);
}

test();