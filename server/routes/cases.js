import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection.js';
import { evaluateTriage } from '../triage/rules.js';
import { routeCase } from '../routing/router.js';
import { sendSMS } from '../notifier/sms.js';

const router = express.Router();

let ioInstance = null;
export function setCasesSocketIO(io) {
  ioInstance = io;
}

// 1. Create or Idempotently Upsert Case
router.post('/', (req, res) => {
  try {
    const {
      id = uuidv4(),
      patient_id,
      created_by_id,
      patient_name,
      patient_age,
      patient_sex,
      patient_village,
      complaint_category,
      symptoms = [],
      duration = '1 day',
      severity = 1,
      vitals = {},
      urgency: clientUrgency,
      suggested_specialty: clientSpecialty,
      triage_reasons: clientReasons,
      assigned_doctor_id: clientDoctorId
    } = req.body;

    // Idempotency check: if case already exists, return existing
    const existing = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    if (existing) {
      return res.json({
        success: true,
        isExisting: true,
        caseItem: formatCase(existing)
      });
    }

    // Evaluate triage if not provided
    let urgency = clientUrgency;
    let suggestedSpecialty = clientSpecialty;
    let triageReasons = clientReasons;

    if (!urgency || !suggestedSpecialty || !triageReasons) {
      const triageRes = evaluateTriage({
        age: patient_age,
        sex: patient_sex,
        complaintCategory: complaint_category,
        symptoms,
        duration,
        severity,
        vitals
      });
      urgency = triageRes.urgency;
      suggestedSpecialty = triageRes.suggestedSpecialty;
      triageReasons = triageRes.reasons;
    }

    // Routing
    let assignedDoctorId = clientDoctorId;
    let routingMessage = '';
    if (!assignedDoctorId) {
      const routeRes = routeCase(suggestedSpecialty);
      if (routeRes.assignedDoctor) {
        assignedDoctorId = routeRes.assignedDoctor.id;
        routingMessage = routeRes.message;
      }
    }

    const now = Date.now();
    const symptomsJson = typeof symptoms === 'string' ? symptoms : JSON.stringify(symptoms);
    const vitalsJson = typeof vitals === 'string' ? vitals : JSON.stringify(vitals);
    const reasonsJson = typeof triageReasons === 'string' ? triageReasons : JSON.stringify(triageReasons);

    const insertStmt = db.prepare(`
      INSERT INTO cases (
        id, patient_id, created_by_id, patient_name, patient_age, patient_sex, patient_village,
        complaint_category, symptoms, duration, severity, vitals,
        urgency, suggested_specialty, triage_reasons, assigned_doctor_id,
        status, consultation_mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      patient_id || 'patient_1',
      created_by_id || patient_id || 'patient_1',
      patient_name || 'Patient',
      Number(patient_age) || 30,
      patient_sex || 'other',
      patient_village || 'Coastal Taluka',
      complaint_category || 'general',
      symptomsJson,
      duration,
      Number(severity) || 1,
      vitalsJson,
      urgency,
      suggestedSpecialty,
      reasonsJson,
      assignedDoctorId || null,
      'pending',
      'video',
      now,
      now
    );

    // If assigned doctor, get doctor details
    let assignedDoctor = null;
    if (assignedDoctorId) {
      assignedDoctor = db.prepare('SELECT id, name, specialty, phone FROM users WHERE id = ?').get(assignedDoctorId);
    }

    // Send simulated SMS alert
    if (urgency === 'Emergency') {
      sendSMS({
        userId: patient_id,
        phone: '+91 98450 12345',
        message: `🚨 SwasthaSetu EMERGENCY Alert: Case for ${patient_name} (${patient_village}) tagged as EMERGENCY. Doctor & 108 Emergency response alerted.`,
        caseId: id
      });
    } else {
      sendSMS({
        userId: patient_id,
        phone: '+91 98450 12345',
        message: `SwasthaSetu: Case #${id.substring(0, 8)} registered. Routed to ${assignedDoctor ? assignedDoctor.name : suggestedSpecialty + ' Queue'}.`,
        caseId: id
      });
    }

    const createdCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    const formatted = formatCase(createdCase);

    // Broadcast queue update to doctors and patients via socket
    if (ioInstance) {
      ioInstance.emit('queue-update', { caseId: id, urgency, doctorId: assignedDoctorId });
      ioInstance.emit('case-updated', formatted);
    }

    res.status(201).json({
      success: true,
      caseItem: formatted,
      routingMessage
    });
  } catch (err) {
    console.error('Error creating case:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. List Cases (filters for patient, ASHA or doctor)
router.get('/', (req, res) => {
  try {
    const { doctor_id, patient_id, created_by, status } = req.query;

    let query = 'SELECT * FROM cases WHERE 1=1';
    const params = [];

    if (doctor_id) {
      query += ' AND assigned_doctor_id = ?';
      params.push(doctor_id);
    }
    if (patient_id) {
      query += ' AND (patient_id = ? OR created_by_id = ?)';
      params.push(patient_id, patient_id);
    }
    if (created_by) {
      query += ' AND created_by_id = ?';
      params.push(created_by);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    // Sort: Urgency first (Emergency, Urgent, Routine), then newest
    query += `
      ORDER BY 
        CASE urgency 
          WHEN 'Emergency' THEN 1 
          WHEN 'Urgent' THEN 2 
          WHEN 'Routine' THEN 3 
          ELSE 4 
        END ASC,
        created_at DESC
    `;

    const rows = db.prepare(query).all(...params);
    const cases = rows.map(formatCase);

    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Single Case Details with messages and doctor info
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);

    if (!caseItem) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    const formatted = formatCase(caseItem);

    // Fetch messages
    const messages = db.prepare(`
      SELECT * FROM messages WHERE case_id = ? ORDER BY created_at ASC
    `).all(id).map(formatMessage);

    // Fetch doctor info
    let doctor = null;
    if (caseItem.assigned_doctor_id) {
      doctor = db.prepare(`
        SELECT id, name, role, phone, specialty, languages, available FROM users WHERE id = ?
      `).get(caseItem.assigned_doctor_id);
      if (doctor && doctor.languages && typeof doctor.languages === 'string') {
        try { doctor.languages = JSON.parse(doctor.languages); } catch (e) {}
      }
    }

    // Fetch prescription advice if any
    const advice = db.prepare(`
      SELECT * FROM prescriptions_advice WHERE case_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(id);

    let formattedAdvice = null;
    if (advice) {
      formattedAdvice = {
        ...advice,
        medicines: JSON.parse(advice.medicines || '[]')
      };
    }

    res.json({
      success: true,
      caseItem: formatted,
      doctor,
      messages,
      advice: formattedAdvice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Send Message (Idempotent with client-generated UUID)
router.post('/:id/messages', (req, res) => {
  try {
    const case_id = req.params.id;
    const {
      id = uuidv4(),
      sender_id,
      sender_role,
      sender_name,
      content,
      message_type = 'text',
      attachment_url = null,
      attachment_meta = null
    } = req.body;

    // Idempotency check: if message id already exists, return it
    const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (existing) {
      return res.json({ success: true, message: formatMessage(existing), isDuplicate: true });
    }

    const now = Date.now();
    const metaJson = attachment_meta ? JSON.stringify(attachment_meta) : null;

    db.prepare(`
      INSERT INTO messages (
        id, case_id, sender_id, sender_role, sender_name, content, message_type, attachment_url, attachment_meta, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      case_id,
      sender_id || 'unknown',
      sender_role || 'patient',
      sender_name || 'User',
      content || '',
      message_type,
      attachment_url,
      metaJson,
      now
    );

    // Update case timestamp
    db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, case_id);

    const message = formatMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));

    // Emit realtime event to the consultation room
    if (ioInstance) {
      ioInstance.to(`case_${case_id}`).emit('message', message);
    }

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('Error posting message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Doctor Advice & Prescription
router.post('/:id/advice', (req, res) => {
  try {
    const case_id = req.params.id;
    const {
      doctor_id,
      diagnosis_note,
      medicines = [],
      follow_up_days = 7,
      mark_completed = false
    } = req.body;

    const prescriptionId = `rx_${uuidv4().substring(0, 8)}`;
    const now = Date.now();
    const medicinesJson = JSON.stringify(medicines);

    db.prepare(`
      INSERT INTO prescriptions_advice (
        id, case_id, doctor_id, diagnosis_note, medicines, follow_up_days, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      prescriptionId,
      case_id,
      doctor_id,
      diagnosis_note || 'Medical advice provided during tele-consultation.',
      medicinesJson,
      Number(follow_up_days) || 7,
      now
    );

    // Update case status
    const newStatus = mark_completed ? 'completed' : 'in-consultation';
    db.prepare(`
      UPDATE cases 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, now, case_id);

    // Post system message into consultation room
    const adviceMsgId = `msg_rx_${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO messages (
        id, case_id, sender_id, sender_role, sender_name, content, message_type, attachment_url, attachment_meta, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adviceMsgId,
      case_id,
      doctor_id,
      'doctor',
      'Dr. Prescription',
      `Prescription generated: ${diagnosis_note}. Follow-up in ${follow_up_days} days.`,
      'advice',
      null,
      medicinesJson,
      now
    );

    // Send SMS notification to patient/ASHA
    const targetCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(case_id);
    const doctor = db.prepare('SELECT name FROM users WHERE id = ?').get(doctor_id);

    sendSMS({
      userId: targetCase.patient_id,
      phone: '+91 98450 12345',
      message: `SwasthaSetu: Dr. ${doctor ? doctor.name : 'Doctor'} has issued your consultation advice & prescription for Case #${case_id.substring(0, 8)}. Please check your app.`,
      caseId: case_id
    });

    if (ioInstance) {
      ioInstance.to(`case_${case_id}`).emit('case-updated', formatCase(targetCase));
      ioInstance.to(`case_${case_id}`).emit('message', {
        id: adviceMsgId,
        case_id,
        sender_id: doctor_id,
        sender_role: 'doctor',
        sender_name: 'Dr. Prescription',
        content: `Prescription generated: ${diagnosis_note}. Follow-up in ${follow_up_days} days.`,
        message_type: 'advice',
        attachment_meta: medicines,
        created_at: now
      });
      ioInstance.emit('queue-update', { caseId: case_id, status: newStatus });
    }

    res.json({
      success: true,
      prescriptionId,
      message: 'Prescription recorded and dispatched via SMS'
    });
  } catch (err) {
    console.error('Error submitting advice:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helpers to parse JSON safely
function formatCase(c) {
  if (!c) return null;
  return {
    ...c,
    symptoms: tryParseJSON(c.symptoms, []),
    vitals: tryParseJSON(c.vitals, {}),
    triage_reasons: tryParseJSON(c.triage_reasons, [])
  };
}

function formatMessage(m) {
  if (!m) return null;
  return {
    ...m,
    attachment_meta: tryParseJSON(m.attachment_meta, null)
  };
}

function tryParseJSON(str, fallback) {
  if (!str) return fallback;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

export default router;
