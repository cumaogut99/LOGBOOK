const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { dbGet, dbRun } = require('../database');

const router = express.Router();

/**
 * POST /api/auth/login
 * User login with JWT token generation
 */
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Kullanıcı adı gerekli'),
  body('password').notEmpty().withMessage('Şifre gerekli')
], async (req, res) => {
  // Input validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    // Find user
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    // Verify password
    // TODO: Şu an plain text comparison, bcrypt'e geçince değiştirilecek
    const isValid = user.passwordHash === password;
    
    if (!isValid) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        fullName: user.fullName,
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback-secret-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Return token and user info
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş işlemi sırasında hata oluştu' });
  }
});

/**
 * POST /api/auth/verify
 * Verify JWT token
 */
router.post('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production');
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(403).json({ error: 'Geçersiz token' });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Mevcut şifre gerekli'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yeni şifre en az 6 karakter olmalı')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // TODO: authenticateToken middleware eklenecek
  // const { userId } = req.user;
  const { currentPassword, newPassword } = req.body;

  try {
    // TODO: Implement password change logic with bcrypt
    res.status(501).json({ error: 'Bu özellik henüz aktif değil' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Şifre değiştirme sırasında hata oluştu' });
  }
});

module.exports = router;

