const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all fields' });
    }

    // Sanitize inputs
    name = name.trim();
    email = email.trim().toLowerCase();

    // Check if user exists (by email or name)
    const userExists = await User.findOne({ $or: [{ email }, { name }] });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with that email or name' });
    }

    // Create user - This triggers the async pre('save') hook in User.js
    const user = await User.create({
      name,
      email,
      password
    });

    if (user) {
      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          provider: 'local'
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/username and password' });
    }

    // Trim whitespace
    const identifier = email.trim().toLowerCase();

    // Check for user by email OR name (case insensitive for name)
    const user = await User.findOne({ 
      $or: [{ email: identifier }, { name: new RegExp(`^${identifier}$`, 'i') }] 
    }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          provider: 'local'
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get current user data
// @route   GET /api/auth/me
router.get('/me', protect, async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        provider: req.user.provider
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Google OAuth Placeholder
router.get('/google', (req, res) => {
  res.status(501).json({ success: false, message: 'Google Auth not implemented yet' });
});

module.exports = router;