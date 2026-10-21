import db from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Notifier interface for SwasthaSetu
 * In low-bandwidth talukas where internet drops entirely, cellular SMS is the ultimate fallback.
 * This module stores simulated SMS messages in a transparent outbox for live demonstration,
 * while maintaining a pluggable interface for future gateways (e.g. CDAC / Gov SMS Gateway / Twilio).
 */

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

export function sendSMS({ userId, phone, message, caseId = null }) {
  const id = `sms_${uuidv4().substring(0, 8)}`;
  const now = Date.now();

  try {
    const stmt = db.prepare(`
      INSERT INTO notifications_sms (id, user_id, phone, message, status, case_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId || null, phone || 'Unknown', message, 'delivered', caseId, now);

    console.log(`📱 [SMS DISPATCHED to ${phone}]: ${message}`);

    // If socket is available, broadcast notification event to all connected clients
    if (ioInstance) {
      ioInstance.emit('sms-sent', {
        id,
        userId,
        phone,
        message,
        caseId,
        createdAt: now,
        status: 'delivered'
      });
    }

    return { success: true, id, status: 'delivered' };
  } catch (err) {
    console.error('Error dispatching SMS:', err);
    return { success: false, error: err.message };
  }
}
