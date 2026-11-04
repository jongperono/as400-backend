const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey_change_in_production";

/**
 * Middleware to verify JWT token and authenticate user
 * Adds user information to req.user if valid
 */
function authenticateToken(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: "Access denied. No token provided." 
      });
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({ 
            error: "Token expired. Please login again." 
          });
        }
        return res.status(403).json({ 
          error: "Invalid token." 
        });
      }

      // Token is valid, add user info to request
      req.user = decoded;
      next();
    });
  } catch (error) {
    return res.status(500).json({ 
      error: "Internal server error during authentication." 
    });
  }
}

/**
 * Optional middleware - verifies token if present but doesn't require it
 * Useful for routes that work differently for authenticated vs non-authenticated users
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      // No token, continue without user info
      req.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        // Invalid token, continue without user info
        req.user = null;
      } else {
        // Valid token, add user info
        req.user = decoded;
      }
      next();
    });
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = {
  authenticateToken,
  optionalAuth,
};
