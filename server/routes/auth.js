import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'swasthasetu-secret-key-coastal-taluka-2026';

// List available demo users for the quick-fill login screen
router.get('/demo-users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, name, role, phone, specialty, languages, available 
      FROM users
      ORDER BY 
        CASE role 
          WHEN 'patient' THEN 1 
          WHEN 'asha' THEN 2 
          WHEN 'doctor' THEN 3 
        END,
        name ASC
    `).all();

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick login or credential-based login
router.post('/login', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    // Parse languages JSON
    if (user.languages && typeof user.languages === 'string') {
      try {
        user.languages = JSON.parse(user.languages);
      } catch (e) {
        user.languages = ['Kannada', 'English'];
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        role: user.role,
        specialty: user.specialty
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Validate session
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User no longer exists' });
    }
    if (user.languages && typeof user.languages === 'string') {
      user.languages = JSON.parse(user.languages);
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

export default router;
