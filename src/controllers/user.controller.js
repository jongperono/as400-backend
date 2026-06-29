const userService = require("../services/user.service");

async function getUsers(req, res) {
  try {
    const filters = {
        useraccount: req.query.useraccount
    }
    console.log(filters)
    const data = await userService.fetchUsers(filters);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// async function getUser(req, res) {
//   console.log('controllers')
//   try {
//     const data = await userService.fetchUserById(req.params.id);
//     res.json(data);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }

// async function createUser(req, res) {
//   try {
//     const result = await userService.addUser(req.body);
//     res.json({ message: "User created", result });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }

module.exports = {
  getUsers,
//   getUser,
//   createUser,
};