# Authentication Middleware

This middleware provides JWT-based authentication for protected API routes.

## Features

- **JWT Token Verification**: Validates JSON Web Tokens
- **Token Expiration Handling**: Returns appropriate errors for expired tokens
- **Flexible Authorization**: Supports both required and optional authentication
- **User Context**: Adds decoded user information to request object

## Middleware Functions

### `authenticateToken`

Requires a valid JWT token to access the route. Returns 401/403 errors if token is missing or invalid.

**Usage:**
```javascript
const { authenticateToken } = require("../middleware/auth.middleware");

// Protect a single route
router.get("/protected", authenticateToken, controller.method);

// Protect all routes in a router
router.use(authenticateToken);
router.get("/users", userController.getUsers);
router.post("/users", userController.createUser);
```

**Token Format:**
The token should be sent in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

**Response Codes:**
- `401`: No token provided or token expired
- `403`: Invalid token
- `500`: Server error during authentication

### `optionalAuth`

Verifies token if present but doesn't require it. Useful for routes that behave differently for authenticated vs. non-authenticated users.

**Usage:**
```javascript
const { optionalAuth } = require("../middleware/auth.middleware");

router.get("/public", optionalAuth, controller.method);
```

If token is valid, `req.user` contains user data. If token is missing or invalid, `req.user` is `null`.

## Accessing User Data

After successful authentication, user information is available in `req.user`:

```javascript
async function getProfile(req, res) {
  // req.user contains decoded JWT payload
  const username = req.user.username;
  const userId = req.user.id;
  
  // Use user info in your controller logic
  const userData = await getUserData(username);
  res.json(userData);
}
```

## Configuration

Set the JWT secret in your `.env` file:

```
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

⚠️ **Security Note**: Always use a strong, random secret in production. Never commit your actual secret to version control.

## Example Implementation

### Protected Routes
```javascript
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const userController = require("../controllers/user.controller");

// All routes below require authentication
router.use(authenticateToken);

router.get("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);
router.delete("/account", userController.deleteAccount);

module.exports = router;
```

### Mixed Public and Protected Routes
```javascript
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const postController = require("../controllers/post.controller");

// Public route
router.get("/posts", postController.getAllPosts);
router.get("/posts/:id", postController.getPost);

// Protected routes
router.post("/posts", authenticateToken, postController.createPost);
router.put("/posts/:id", authenticateToken, postController.updatePost);
router.delete("/posts/:id", authenticateToken, postController.deletePost);

module.exports = router;
```

## Testing with cURL

### Get Token (Login)
```bash
curl -X POST http://localhost:3008/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

### Access Protected Route
```bash
curl http://localhost:3008/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Error Responses

### No Token
```json
{
  "error": "Access denied. No token provided."
}
```

### Expired Token
```json
{
  "error": "Token expired. Please login again."
}
```

### Invalid Token
```json
{
  "error": "Invalid token."
}
```
