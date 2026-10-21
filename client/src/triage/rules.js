/**
 * SwasthaSetu Rule-Based Medical Triage Engine (Client-Side & Server-Side Shared)
 * Fully explainable, deterministic, clinical protocol based for rural/remote talukas.
 */

export const SPECIALTY_MAP = {
  heart: 'Cardiology',
  chest: 'Cardiology',
  cardiology: 'Cardiology',
  skin: 'Dermatology',
  dermatology: 'Dermatology',
  pregnancy: 'Gynaecology',
  women: 'Gynaecology',
  gynaecology: 'Gynaecology',
  child: 'Paediatrics',
  children: 'Paediatrics',
  paediatrics: 'Paediatrics',
  pediatrics: 'Paediatrics',
  bones: 'Orthopaedics',
  injury: 'Orthopaedics',
  orthopaedics: 'Orthopaedics',
  general: 'General Medicine'
};

export function evaluateTriage(input = {}) {
  const {
    age = 30,
    sex = 'other',
    complaintCategory = 'general',
    symptoms = [],
    duration = '1 day',
    severity = 1,
    vitals = {}
  } = input;

  const reasons = [];
  let urgency = 'Routine';
  let emergencyAction = null;

  const normalizedSymptoms = Array.isArray(symptoms)
    ? symptoms.map(s => String(s).toLowerCase().trim())
    : [];

  const categoryLower = String(complaintCategory).toLowerCase();
  const durationLower = String(duration).toLowerCase();
  const numAge = Number(age);
  const numSeverity = Number(severity);
  const temp = vitals.temperature ? Number(vitals.temperature) : null;
  const spo2 = vitals.spo2 !== undefined && vitals.spo2 !== null && vitals.spo2 !== ''
    ? Number(vitals.spo2)
    : null;

  const hasSymptom = (key) => normalizedSymptoms.some(s => s.includes(key));

  // --- 1. EMERGENCY RULES ---
  const emergencyChecks = [];

  if (hasSymptom('chest pain') || normalizedSymptoms.includes('chest_pain')) {
    emergencyChecks.push('Chest pain reported, immediate cardiac evaluation required');
  }

  if (
    hasSymptom('severe difficulty breathing') ||
    hasSymptom('breathlessness') ||
    normalizedSymptoms.includes('severe_dyspnea')
  ) {
    emergencyChecks.push('Severe difficulty breathing reported, critical airway risk');
  }

  if (
    hasSymptom('unconscious') ||
    hasSymptom('fainting') ||
    hasSymptom('loss of consciousness') ||
    normalizedSymptoms.includes('unconsciousness')
  ) {
    emergencyChecks.push('Unconsciousness or fainting reported');
  }

  if (
    hasSymptom('face droop') ||
    hasSymptom('slurred speech') ||
    hasSymptom('one-sided weakness') ||
    hasSymptom('stroke') ||
    normalizedSymptoms.includes('stroke_signs')
  ) {
    emergencyChecks.push('FAST stroke indicators (face droop, slurred speech or weakness) observed');
  }

  if (hasSymptom('seizure') || normalizedSymptoms.includes('seizure')) {
    emergencyChecks.push('Active or recent seizure reported');
  }

  if (hasSymptom('heavy bleeding') || normalizedSymptoms.includes('heavy_bleeding')) {
    emergencyChecks.push('Severe/heavy active bleeding reported');
  }

  if (
    (categoryLower.includes('pregnancy') || categoryLower.includes('women') || sex.toLowerCase() === 'female') &&
    (hasSymptom('bleeding') || hasSymptom('pregnancy bleeding') || normalizedSymptoms.includes('pregnancy_bleeding'))
  ) {
    emergencyChecks.push('Vaginal bleeding during pregnancy reported (high obstetric risk)');
  }

  if (spo2 !== null && !isNaN(spo2) && spo2 < 90) {
    emergencyChecks.push(`Critically low blood oxygen level (SpO2: ${spo2}% < 90%)`);
  }

  if (emergencyChecks.length > 0) {
    urgency = 'Emergency';
    reasons.push(...emergencyChecks);
    emergencyAction = 'Call 108 or go to the nearest taluka/district hospital immediately. We are alerting the emergency doctor on call.';
  } else {
    // --- 2. URGENT RULES ---
    const urgentChecks = [];

    const isFever = hasSymptom('fever') || normalizedSymptoms.includes('fever') || categoryLower.includes('fever');
    const isOver3Days = (
      durationLower.includes('4') ||
      durationLower.includes('5') ||
      durationLower.includes('week') ||
      durationLower.includes('month') ||
      (durationLower.includes('3') && durationLower.includes('more')) ||
      durationLower.includes('> 3')
    );
    if (isFever && isOver3Days) {
      urgentChecks.push('Persistent high fever exceeding 3 days duration');
    }

    if (
      hasSymptom('persistent vomiting') ||
      hasSymptom('diarrhoea') ||
      hasSymptom('diarrhea') ||
      normalizedSymptoms.includes('vomiting_diarrhea')
    ) {
      urgentChecks.push('Persistent vomiting or severe diarrhoea with dehydration risk');
    }

    if (numSeverity >= 4) {
      urgentChecks.push(`High patient-reported severity score (${numSeverity}/5)`);
    }

    if (numAge < 5 && isFever) {
      urgentChecks.push(`Paediatric patient under 5 years presenting with fever (Age: ${numAge})`);
    }

    if (
      hasSymptom('swelling') ||
      hasSymptom('deformity') ||
      hasSymptom('fracture') ||
      normalizedSymptoms.includes('injury_swelling')
    ) {
      urgentChecks.push('Acute musculoskeletal injury with visible swelling or deformity');
    }

    if (spo2 !== null && !isNaN(spo2) && spo2 >= 90 && spo2 <= 93) {
      urgentChecks.push(`Borderline low blood oxygen level (SpO2: ${spo2}% [90-93%])`);
    }

    if (temp !== null && !isNaN(temp)) {
      if (temp >= 39 || (temp >= 102.2 && temp < 115)) {
        urgentChecks.push(`High body temperature measured (${temp}°${temp > 45 ? 'F' : 'C'})`);
      }
    }

    if (urgentChecks.length > 0) {
      urgency = 'Urgent';
      reasons.push(...urgentChecks);
    } else {
      urgency = 'Routine';
      reasons.push('Standard primary healthcare consultation; no immediate red-flag indicators detected.');
    }
  }

  // --- 3. SPECIALTY MAPPING ---
  let suggestedSpecialty = 'General Medicine';

  if (categoryLower.includes('heart') || categoryLower.includes('chest') || categoryLower.includes('cardio')) {
    suggestedSpecialty = 'Cardiology';
  } else if (categoryLower.includes('skin') || categoryLower.includes('derma') || hasSymptom('rash') || hasSymptom('itching')) {
    suggestedSpecialty = 'Dermatology';
  } else if (categoryLower.includes('pregnancy') || categoryLower.includes('women') || categoryLower.includes('gynae') || categoryLower.includes('maternity')) {
    suggestedSpecialty = 'Gynaecology';
  } else if (categoryLower.includes('child') || categoryLower.includes('paed') || categoryLower.includes('ped') || numAge < 12) {
    suggestedSpecialty = 'Paediatrics';
  } else if (categoryLower.includes('bone') || categoryLower.includes('ortho') || categoryLower.includes('joint') || categoryLower.includes('fracture')) {
    suggestedSpecialty = 'Orthopaedics';
  }

  return {
    urgency,
    suggestedSpecialty,
    reasons,
    emergencyAction,
    disclaimer: 'Prototype for demonstration. Not a substitute for professional medical advice.'
  };
}
