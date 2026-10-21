/**
 * SwasthaSetu Specialist Router
 * Routes incoming triage cases to the optimal available doctor:
 * 1. Matches requested specialty (or falls back to General Medicine)
 * 2. Selects doctor with lowest active queue length
 * 3. Ties broken by longest idle time (lowest idle_since timestamp)
 * 4. Gracefully handles zero-availability by queuing for the specialty
 */

import db from '../db/connection.js';

export function routeCase(suggestedSpecialty) {
  // Query doctors in the requested specialty, computing their current active queue length
  const query = `
    SELECT 
      u.id, 
      u.name, 
      u.specialty, 
      u.languages, 
      u.available, 
      u.idle_since,
      COUNT(c.id) as current_queue_length
    FROM users u
    LEFT JOIN cases c ON c.assigned_doctor_id = u.id AND c.status IN ('pending', 'in-consultation')
    WHERE u.role = 'doctor' 
      AND u.available = 1 
      AND (u.specialty = ? OR u.specialty = 'General Medicine')
    GROUP BY u.id
    ORDER BY 
      CASE WHEN u.specialty = ? THEN 0 ELSE 1 END,
      current_queue_length ASC,
      u.idle_since ASC
  `;

  const doctors = db.prepare(query).all(suggestedSpecialty, suggestedSpecialty);

  if (!doctors || doctors.length === 0) {
    // If no available doctor in specialty or general medicine, query any available doctor
    const fallbackQuery = `
      SELECT 
        u.id, 
        u.name, 
        u.specialty, 
        u.languages, 
        u.available, 
        u.idle_since,
        COUNT(c.id) as current_queue_length
      FROM users u
      LEFT JOIN cases c ON c.assigned_doctor_id = u.id AND c.status IN ('pending', 'in-consultation')
      WHERE u.role = 'doctor' AND u.available = 1
      GROUP BY u.id
      ORDER BY current_queue_length ASC, u.idle_since ASC
      LIMIT 1
    `;
    const fallbackDoc = db.prepare(fallbackQuery).get();
    if (fallbackDoc) {
      return {
        assignedDoctor: fallbackDoc,
        status: 'assigned',
        message: `Assigned to ${fallbackDoc.name} (${fallbackDoc.specialty}) based on queue availability.`
      };
    }

    return {
      assignedDoctor: null,
      status: 'queued',
      message: `All specialists currently offline or attending critical consultations. Case placed in priority specialty queue for ${suggestedSpecialty}.`
    };
  }

  const selectedDoctor = doctors[0];
  return {
    assignedDoctor: selectedDoctor,
    status: 'assigned',
    message: `Routed to Dr. ${selectedDoctor.name} (${selectedDoctor.specialty}) - Queue: ${selectedDoctor.current_queue_length} patients waiting.`
  };
}

/**
 * Get sorted doctor queue according to Urgency (Emergency > Urgent > Routine), then FIFO wait time.
 */
export function getDoctorQueue(doctorId) {
  const query = `
    SELECT * FROM cases 
    WHERE assigned_doctor_id = ? AND status IN ('pending', 'in-consultation')
    ORDER BY 
      CASE urgency 
        WHEN 'Emergency' THEN 1 
        WHEN 'Urgent' THEN 2 
        WHEN 'Routine' THEN 3 
        ELSE 4 
      END ASC,
      created_at ASC
  `;
  return db.prepare(query).all(doctorId);
}
