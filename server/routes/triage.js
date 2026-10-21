import express from 'express';
import { evaluateTriage } from '../triage/rules.js';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const input = req.body;
    const result = evaluateTriage(input);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
