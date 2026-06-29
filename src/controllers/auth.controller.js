const authService = require("../services/auth.service");

async function signup(req, res) {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: "Please provide name, username, and password" });
    }

    const data = await authService.signup({ name, username, password });
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Please provide username and password" });
    }

    const data = await authService.login({ username, password });
    res.json(data);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

module.exports = {
  signup,
  login,
};
