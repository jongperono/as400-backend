const userRepo = require("../repositories/user.repository");

async function fetchUsers(filters) {
    console.log(filters,'fetchUsers')
    return await userRepo.getAllUsers(filters);
}

// async function fetchUserById(id) {
//   console.log('services')
//   if (!id) throw new Error("ID is required");
//   return await userRepo.getUserById(id);
// }

// async function addUser(user) {
//   if (!user.name || !user.email) {
//     throw new Error("Invalid user data");
//   }

//   return await userRepo.createUser(user);
// }

module.exports = {
  fetchUsers,
//   fetchUserById,
//   addUser,
};