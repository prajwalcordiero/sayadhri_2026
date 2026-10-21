import test from 'node:test';
import assert from 'node:assert';
import { evaluateTriage, SPECIALTY_MAP } from '../triage/rules.js';

test('Triage Engine - Emergency Triggers', async (t) => {
  await t.test('triggers Emergency for chest pain', () => {
    const res = evaluateTriage({
      symptoms: ['chest pain', 'sweating'],
      complaintCategory: 'heart'
    });
    assert.strictEqual(res.urgency, 'Emergency');
    assert.strictEqual(res.suggestedSpecialty, 'Cardiology');
    assert(res.reasons.some(r => r.includes('Chest pain')));
    assert(res.emergencyAction.includes('108'));
  });

  await t.test('triggers Emergency for SpO2 below 90%', () => {
    const res = evaluateTriage({
      symptoms: ['mild cough'],
      vitals: { spo2: 87 }
    });
    assert.strictEqual(res.urgency, 'Emergency');
    assert(res.reasons.some(r => r.includes('SpO2: 87%')));
  });

  await t.test('triggers Emergency for stroke signs', () => {
    const res = evaluateTriage({
      symptoms: ['face droop', 'slurred speech']
    });
    assert.strictEqual(res.urgency, 'Emergency');
    assert(res.reasons.some(r => r.includes('stroke indicators')));
  });

  await t.test('triggers Emergency for pregnancy with bleeding', () => {
    const res = evaluateTriage({
      sex: 'female',
      complaintCategory: 'pregnancy',
      symptoms: ['bleeding', 'cramps']
    });
    assert.strictEqual(res.urgency, 'Emergency');
    assert.strictEqual(res.suggestedSpecialty, 'Gynaecology');
    assert(res.reasons.some(r => r.includes('pregnancy')));
  });
});

test('Triage Engine - Urgent Triggers', async (t) => {
  await t.test('triggers Urgent for fever lasting > 3 days', () => {
    const res = evaluateTriage({
      symptoms: ['fever', 'headache'],
      duration: '4 days',
      severity: 3
    });
    assert.strictEqual(res.urgency, 'Urgent');
    assert(res.reasons.some(r => r.includes('exceeding 3 days')));
  });

  await t.test('triggers Urgent for child under 5 with fever', () => {
    const res = evaluateTriage({
      age: 3,
      symptoms: ['fever'],
      duration: '1 day'
    });
    assert.strictEqual(res.urgency, 'Urgent');
    assert.strictEqual(res.suggestedSpecialty, 'Paediatrics');
    assert(res.reasons.some(r => r.includes('under 5 years')));
  });

  await t.test('triggers Urgent for high severity rating (4-5)', () => {
    const res = evaluateTriage({
      severity: 5,
      symptoms: ['back pain']
    });
    assert.strictEqual(res.urgency, 'Urgent');
    assert(res.reasons.some(r => r.includes('severity score')));
  });

  await t.test('triggers Urgent for high body temperature (>= 39°C)', () => {
    const res = evaluateTriage({
      symptoms: ['chills'],
      vitals: { temperature: 39.5 }
    });
    assert.strictEqual(res.urgency, 'Urgent');
    assert(res.reasons.some(r => r.includes('39.5')));
  });
});

test('Triage Engine - Routine and Specialty Mapping', async (t) => {
  await t.test('maps skin complaints to Dermatology and Routine when non-critical', () => {
    const res = evaluateTriage({
      complaintCategory: 'skin',
      symptoms: ['dry patches', 'itching'],
      duration: '2 weeks',
      severity: 2
    });
    assert.strictEqual(res.urgency, 'Routine');
    assert.strictEqual(res.suggestedSpecialty, 'Dermatology');
  });

  await t.test('maps bone complaints to Orthopaedics', () => {
    const res = evaluateTriage({
      complaintCategory: 'bones',
      symptoms: ['knee ache'],
      severity: 2
    });
    assert.strictEqual(res.suggestedSpecialty, 'Orthopaedics');
  });

  await t.test('always includes non-diagnostic prototype disclaimer', () => {
    const res = evaluateTriage({});
    assert(res.disclaimer.includes('Not a substitute for professional medical advice'));
  });
});
