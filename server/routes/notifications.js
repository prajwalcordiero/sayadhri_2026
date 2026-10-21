import express from 'express';
import db from '../db/connection.js';

const router = express.Router();

// Get simulated SMS and system notifications
router.get('/', (req, res) => {
  try {
    const { user_id, phone } = req.query;
    let query = 'SELECT * FROM notifications_sms WHERE 1=1';
    const params = [];

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    if (phone) {
      query += ' AND phone = ?';
      params.push(phone);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';
    const notifications = db.prepare(query).all(...params);

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
