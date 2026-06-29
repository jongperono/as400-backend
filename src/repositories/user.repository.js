const { getConnection } = require("../config/db");

async function getAllUsers(filters) {
  console.log(filters, 'repo')
  const db = await getConnection();
  let sql = `select UPUPRF, UPTEXT, UPSTAT from qgpl.usrdta`
  var params = []
  if (filters.useraccount) {
    sql += ` where UPUPRF like ?`
    params.push(`%${filters.useraccount}%`)
    // [`'${filters.useraccount}'`]
  }
  console.log(sql)
  return await db.query(sql, params);
}

// async function getUserById(id) {
//   console.log('repositories')
//   const db = await getConnection();
//   return await db.query(
//     "select * from qgpl.usrdta where UPUPRF = DAN",
//     // [id]
//   );
// }

// async function createUser(user) {
//   const db = await getConnection();

//   const sql =
//     "INSERT INTO USERS (NAME, EMAIL) VALUES (?, ?)";

//   return await db.query(sql, [user.name, user.email]);
// }

module.exports = {
  getAllUsers,
  //   getUserById,
  //   createUser,
};