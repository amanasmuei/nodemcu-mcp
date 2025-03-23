const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Mock user database (in a real app, this would be in a database)
const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123', // In a real app, this would be hashed
    role: 'admin'
  }
];

// Login route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Find user
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      message: 'Invalid username or password'
    });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      id: user.id, 
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET || 'default_secret_key',
    { expiresIn: '24h' }
  );
  
  res.status(200).json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// Validate token route
router.post('/validate', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      message: 'Token is required'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');
    res.status(200).json({
      valid: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      message: 'Invalid token',
      error: error.message
    });
  }
});

module.exports = {
  authRouter: router
}; 