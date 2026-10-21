import express from 'express';
import db from '../db/connection.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const doctors = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.role, 
        u.phone, 
        u.specialty, 
        u.languages, 
        u.available, 
        u.idle_since,
        COUNT(c.id) as current_queue_length
      FROM users u
      LEFT JOIN cases c ON c.assigned_doctor_id = u.id AND c.status IN ('pending', 'in-consultation')
      WHERE u.role = 'doctor'
      GROUP BY u.id
      ORDER BY u.specialty ASC, current_queue_length ASC
    `).all();

    const formatted = doctors.map(d => ({
      ...d,
      languages: typeof d.languages === 'string' ? JSON.parse(d.languages || '[]') : d.languages
    }));

    res.json({ success: true, doctors: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Doctor toggle availability
router.post('/:id/availability', (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;
    const val = available ? 1 : 0;
    const now = Date.now();

    db.prepare('UPDATE users SET available = ?, idle_since = ? WHERE id = ?').run(val, now, id);
    res.json({ success: true, available: val });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
