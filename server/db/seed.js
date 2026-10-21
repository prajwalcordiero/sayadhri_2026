import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function seedDatabase() {
  console.log('🔄 Executing SwasthaSetu database schema and seeding...');

  // 1. Run schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Clear existing demo data to ensure a fresh clean seed
  db.prepare('DELETE FROM impact_stats').run();
  db.prepare('DELETE FROM notifications_sms').run();
  db.prepare('DELETE FROM uploads').run();
  db.prepare('DELETE FROM prescriptions_advice').run();
  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM cases').run();
  db.prepare('DELETE FROM users').run();

  const now = Date.now();

  // 2. Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, role, phone, specialty, languages, available, idle_since, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    // Patient
    ['patient_1', 'Ramesh Gowda', 'patient', '+91 98450 12345', null, '["Kannada", "English"]', 1, now - 3600000, now - 86400000],
    ['patient_2', 'Gowramma Hegde', 'patient', '+91 98450 67890', null, '["Kannada"]', 1, now - 7200000, now - 86400000],

    // ASHA Worker
    ['asha_1', 'Sunitha Hegde (ASHA Worker)', 'asha', '+91 94812 33445', null, '["Kannada", "English", "Konkani"]', 1, now - 1800000, now - 86400000],

    // 9 Doctors across 6 specialties
    ['doc_cardio_1', 'Dr. Ananya Bhat', 'doctor', '+91 94481 00101', 'Cardiology', '["Kannada", "English", "Konkani"]', 1, now - 5000000, now - 86400000 * 30],
    ['doc_cardio_2', 'Dr. Vivek Murthy', 'doctor', '+91 94481 00102', 'Cardiology', '["Kannada", "English"]', 1, now - 2000000, now - 86400000 * 30],
    ['doc_derma_1', 'Dr. Priya Kamath', 'doctor', '+91 94481 00103', 'Dermatology', '["Kannada", "English", "Tulu"]', 1, now - 4000000, now - 86400000 * 30],
    ['doc_gynae_1', 'Dr. Shruthi Naik', 'doctor', '+91 94481 00104', 'Gynaecology', '["Kannada", "English"]', 1, now - 3500000, now - 86400000 * 30],
    ['doc_paed_1', 'Dr. Kiran Rao', 'doctor', '+91 94481 00105', 'Paediatrics', '["Kannada", "English"]', 1, now - 6000000, now - 86400000 * 30],
    ['doc_paed_2', 'Dr. Sneha Patil', 'doctor', '+91 94481 00106', 'Paediatrics', '["Kannada", "English", "Marathi"]', 1, now - 1000000, now - 86400000 * 30],
    ['doc_ortho_1', 'Dr. Rajesh Shettigar', 'doctor', '+91 94481 00107', 'Orthopaedics', '["Kannada", "English"]', 1, now - 4500000, now - 86400000 * 30],
    ['doc_gen_1', 'Dr. Mohammed Irfan', 'doctor', '+91 94481 00108', 'General Medicine', '["Kannada", "English", "Urdu"]', 1, now - 8000000, now - 86400000 * 30],
    ['doc_gen_2', 'Dr. Kavita Desai', 'doctor', '+91 94481 00109', 'General Medicine', '["Kannada", "English"]', 1, now - 3000000, now - 86400000 * 30]
  ];

  for (const u of users) {
    insertUser.run(...u);
  }

  // 3. Seed Demo Cases
  const insertCase = db.prepare(`
    INSERT INTO cases (
      id, patient_id, created_by_id, patient_name, patient_age, patient_sex, patient_village,
      complaint_category, symptoms, duration, severity, vitals,
      urgency, suggested_specialty, triage_reasons, assigned_doctor_id,
      status, consultation_mode, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cases = [
    [
      'case_seed_1_emergency',
      'patient_1',
      'asha_1',
      'Manjunath Patgar',
      58,
      'male',
      'Gokarna Coastal Hamlet, Kumta',
      'heart',
      JSON.stringify(['chest pain', 'severe difficulty breathing', 'cold sweats']),
      '2 hours',
      5,
      JSON.stringify({ temperature: 37.0, spo2: 88, bp: '150/95', pulse: 104 }),
      'Emergency',
      'Cardiology',
      JSON.stringify([
        'Chest pain reported, immediate cardiac evaluation required',
        'Severe difficulty breathing reported, critical airway risk',
        'Critically low blood oxygen level (SpO2: 88% < 90%)'
      ]),
      'doc_cardio_1',
      'pending',
      'video',
      now - 15 * 60 * 1000, // 15 mins ago
      now - 15 * 60 * 1000
    ],
    [
      'case_seed_2_urgent',
      'patient_1',
      'asha_1',
      'Tanvi Naik',
      4,
      'female',
      'Devimane Ghat, Sirsi',
      'child',
      JSON.stringify(['fever', 'persistent vomiting', 'lethargy']),
      '4 days',
      4,
      JSON.stringify({ temperature: 39.4, spo2: 96, pulse: 120 }),
      'Urgent',
      'Paediatrics',
      JSON.stringify([
        'Paediatric patient under 5 years presenting with fever (Age: 4)',
        'Persistent high fever exceeding 3 days duration',
        'High body temperature measured (39.4°C)'
      ]),
      'doc_paed_1',
      'pending',
      'audio',
      now - 45 * 60 * 1000, // 45 mins ago
      now - 45 * 60 * 1000
    ],
    [
      'case_seed_3_routine',
      'patient_2',
      'patient_2',
      'Gowramma Hegde',
      42,
      'female',
      'Bilgi Village, Siddapur Taluka',
      'skin',
      JSON.stringify(['itchy red skin lesions', 'mild burning']),
      '1 week',
      2,
      JSON.stringify({ temperature: 36.8, spo2: 98 }),
      'Routine',
      'Dermatology',
      JSON.stringify([
        'Standard primary healthcare consultation; no immediate red-flag indicators detected.'
      ]),
      'doc_derma_1',
      'pending',
      'chat',
      now - 2 * 3600 * 1000, // 2 hours ago
      now - 2 * 3600 * 1000
    ]
  ];

  for (const c of cases) {
    insertCase.run(...c);
  }

  // 4. Seed Messages for Case 3 (demonstrating previous chat history)
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, case_id, sender_id, sender_role, sender_name, content, message_type, attachment_url, attachment_meta, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMessage.run(
    'msg_seed_1',
    'case_seed_3_routine',
    'patient_2',
    'patient',
    'Gowramma Hegde',
    'Namaskara Doctor, I have had this red rash on my arm for 7 days after working in the arecanut plantation.',
    'text',
    null,
    null,
    now - 110 * 60 * 1000
  );

  insertMessage.run(
    'msg_seed_2',
    'case_seed_3_routine',
    'doc_derma_1',
    'doctor',
    'Dr. Priya Kamath',
    'Namaskara Gowramma. Please upload a clear photo of the rash using the camera icon below. Our app compresses it automatically.',
    'text',
    null,
    null,
    now - 100 * 60 * 1000
  );

  // 5. Seed SMS Notifications
  const insertSMS = db.prepare(`
    INSERT INTO notifications_sms (id, user_id, phone, message, status, case_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertSMS.run(
    'sms_seed_1',
    'patient_1',
    '+91 98450 12345',
    'SwasthaSetu Alert: Emergency Case #1 has been prioritized for Dr. Ananya Bhat (Cardiology). Ambulance dispatched if required.',
    'delivered',
    'case_seed_1_emergency',
    now - 14 * 60 * 1000
  );

  insertSMS.run(
    'sms_seed_2',
    'asha_1',
    '+91 94812 33445',
    'SwasthaSetu: Case for Tanvi Naik routed to Dr. Kiran Rao (Paediatrics). Queue position: 1.',
    'delivered',
    'case_seed_2_urgent',
    now - 44 * 60 * 1000
  );

  // 6. Seed Baseline Impact Stats
  const insertStat = db.prepare(`
    INSERT INTO impact_stats (session_id, mode, bytes_sent, bytes_received, degradation_events, consultations_completed, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertStat.run('baseline_sim', 'video', 3500000, 4200000, 1, 3, now - 86400000);
  insertStat.run('baseline_sim', 'audio', 480000, 520000, 4, 6, now - 43200000);
  insertStat.run('baseline_sim', 'chat', 85000, 92000, 8, 12, now - 21600000);
  insertStat.run('baseline_sim', 'store-forward', 120000, 140000, 6, 8, now - 7200000);

  console.log('✅ SwasthaSetu database seeded successfully with users, demo cases, messages, SMS logs & stats!');
}

// Execute directly if run as a script
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
  process.exit(0);
}
