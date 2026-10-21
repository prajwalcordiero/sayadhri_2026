import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  Baby,
  Activity,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  User,
  MapPin,
  Thermometer,
  Wind
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { evaluateTriage } from '../triage/rules.js';
import { enqueueOutboxItem, saveCasesLocally } from '../outbox/db.js';

export default function TriageWizard({ user, onCompleteTriage, t, lang, mode }) {
  const isAsha = user?.role === 'asha';

  // Step state: 1 to 5
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    patient_name: isAsha ? '' : user?.name || 'Ramesh Gowda',
    patient_age: isAsha ? '' : 45,
    patient_sex: 'male',
    patient_village: isAsha ? 'Devimane Ghat, Sirsi' : 'Gokarna Coastal Hamlet',
    complaint_category: 'general',
    symptoms: [],
    duration: '2-3 days',
    severity: 3,
    temperature: '',
    spo2: '',
    bp: ''
  });

  const categories = [
    { key: 'heart', label: t.catHeart, icon: Heart, color: 'text-red-400 border-red-500/30 bg-red-950/20' },
    { key: 'skin', label: t.catSkin, icon: Sparkles, color: 'text-amber-400 border-amber-500/30 bg-amber-950/20' },
    { key: 'pregnancy', label: t.catPregnancy, icon: Activity, color: 'text-pink-400 border-pink-500/30 bg-pink-950/20' },
    { key: 'child', label: t.catChild, icon: Baby, color: 'text-sky-400 border-sky-500/30 bg-sky-950/20' },
    { key: 'bones', label: t.catBones, icon: Activity, color: 'text-teal-400 border-teal-500/30 bg-teal-950/20' },
    { key: 'general', label: t.catGeneral, icon: Thermometer, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/20' }
  ];

  const symptomOptions = {
    heart: ['chest pain', 'severe difficulty breathing', 'cold sweats', 'radiating arm pain', 'palpitations'],
    skin: ['itchy red rash', 'blisters', 'severe burning', 'swelling', 'dry scaly skin'],
    pregnancy: ['severe abdominal cramps', 'vaginal bleeding', 'headache with blurred vision', 'reduced fetal movement', 'morning sickness'],
    child: ['fever above 3 days', 'persistent vomiting', 'refusal to feed', 'rapid breathing', 'ear ache'],
    bones: ['joint swelling', 'inability to bear weight', 'visible bone deformity', 'fracture pain', 'back pain'],
    general: ['high fever', 'cough with phlegm', 'persistent vomiting', 'loose stools/diarrhoea', 'severe headache', 'body ache']
  };

  const toggleSymptom = (sym) => {
    setFormData(prev => {
      const exists = prev.symptoms.includes(sym);
      return {
        ...prev,
        symptoms: exists ? prev.symptoms.filter(s => s !== sym) : [...prev.symptoms, sym]
      };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const caseId = `case_${uuidv4().substring(0, 8)}`;

    const casePayload = {
      id: caseId,
      patient_id: isAsha ? `villager_${uuidv4().substring(0, 6)}` : user.id,
      created_by_id: user.id,
      patient_name: formData.patient_name || 'Patient',
      patient_age: Number(formData.patient_age) || 30,
      patient_sex: formData.patient_sex,
      patient_village: formData.patient_village || 'Coastal Taluka',
      complaint_category: formData.complaint_category,
      symptoms: formData.symptoms,
      duration: formData.duration,
      severity: Number(formData.severity),
      vitals: {
        temperature: formData.temperature ? Number(formData.temperature) : undefined,
        spo2: formData.spo2 ? Number(formData.spo2) : undefined,
        bp: formData.bp || undefined
      }
    };

    // Calculate rule-based triage on client immediately so offline works with 0 latency
    const localTriageResult = evaluateTriage({
      age: casePayload.patient_age,
      sex: casePayload.patient_sex,
      complaintCategory: casePayload.complaint_category,
      symptoms: casePayload.symptoms,
      duration: casePayload.duration,
      severity: casePayload.severity,
      vitals: casePayload.vitals
    });

    const fullCase = {
      ...casePayload,
      urgency: localTriageResult.urgency,
      suggested_specialty: localTriageResult.suggestedSpecialty,
      triage_reasons: localTriageResult.reasons,
      emergency_action: localTriageResult.emergencyAction,
      status: 'pending',
      consultation_mode: mode || 'video',
      created_at: Date.now(),
      updated_at: Date.now()
    };

    // Save to local cache first
    await saveCasesLocally([fullCase]);

    // Check if network is offline or very poor
    const isOffline = mode === 'store-forward' || !navigator.onLine;

    if (isOffline) {
      // Store in outbox for background sync
      await enqueueOutboxItem({
        id: `outbox_case_${caseId}`,
        type: 'case',
        endpoint: '/api/cases',
        payload: fullCase
      });
      setSubmitting(false);
      onCompleteTriage(fullCase, localTriageResult, true); // true = queued in outbox
    } else {
      try {
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullCase)
        });
        const data = await res.json();
        setSubmitting(false);
        if (data.success) {
          onCompleteTriage(data.caseItem, localTriageResult, false);
        } else {
          // Fallback to outbox on server failure
          await enqueueOutboxItem({
            id: `outbox_case_${caseId}`,
            type: 'case',
            endpoint: '/api/cases',
            payload: fullCase
          });
          onCompleteTriage(fullCase, localTriageResult, true);
        }
      } catch (err) {
        // Network dropped mid-request: save to outbox
        await enqueueOutboxItem({
          id: `outbox_case_${caseId}`,
          type: 'case',
          endpoint: '/api/cases',
          payload: fullCase
        });
        setSubmitting(false);
        onCompleteTriage(fullCase, localTriageResult, true);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-[#1C2541] border border-slate-700 rounded-2xl p-6 shadow-xl text-white">
        {/* Progress Bar & Step Indicator */}
        <div className="mb-6">
          <div className="flex justify-between items-center text-xs font-bold text-amber-400 mb-2">
            <span>
              STEP {step} OF 5: {step === 1 ? t.stepPatientInfo : step === 2 ? t.stepCategory : step === 3 ? t.stepSymptoms : step === 4 ? t.stepDurationSeverity : t.stepVitals}
            </span>
            <span className="font-mono">{step * 20}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${step * 20}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Patient Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <User className="text-amber-400" size={20} />
              <span>{t.stepPatientInfo}</span>
            </h2>

            {isAsha && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-xl text-xs text-emerald-200">
                <strong>ASHA Worker Mode:</strong> Enter the patient’s details from the coastal village/hamlet you are visiting.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t.labelName}</label>
              <input
                type="text"
                value={formData.patient_name}
                onChange={e => setFormData({ ...formData, patient_name: e.target.value })}
                placeholder="e.g. Ramesh Gowda"
                className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t.labelAge}</label>
                <input
                  type="number"
                  value={formData.patient_age}
                  onChange={e => setFormData({ ...formData, patient_age: e.target.value })}
                  placeholder="e.g. 45"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t.labelSex}</label>
                <select
                  value={formData.patient_sex}
                  onChange={e => setFormData({ ...formData, patient_sex: e.target.value })}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none"
                >
                  <option value="male">{t.male}</option>
                  <option value="female">{t.female}</option>
                  <option value="other">{t.other}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t.labelVillage}</label>
              <input
                type="text"
                value={formData.patient_village}
                onChange={e => setFormData({ ...formData, patient_village: e.target.value })}
                placeholder="e.g. Bilgi Village, Siddapur"
                className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Main Complaint Category */}
        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Activity className="text-amber-400" size={20} />
              <span>{t.stepCategory}</span>
            </h2>
            <p className="text-xs text-slate-400">Select the primary bodily area or symptom group:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {categories.map(c => {
                const Icon = c.icon;
                const isSelected = formData.complaint_category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setFormData({ ...formData, complaint_category: c.key, symptoms: [] })}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-md ring-1 ring-amber-400'
                        : `${c.color} hover:border-slate-500`
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-slate-900/50">
                      <Icon size={20} />
                    </div>
                    <span className="font-semibold text-sm">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Symptoms Checklist */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CheckCircle className="text-amber-400" size={20} />
              <span>{t.stepSymptoms}</span>
            </h2>
            <p className="text-xs text-slate-400">Tap all symptoms currently experienced:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(symptomOptions[formData.complaint_category] || symptomOptions.general).map(s => {
                const isChecked = formData.symptoms.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    className={`p-3 rounded-xl border text-left text-sm font-medium transition-all flex items-center justify-between ${
                      isChecked
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-[#0B132B] border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="capitalize">{s}</span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                      isChecked ? 'bg-amber-500 text-slate-950' : 'border border-slate-600'
                    }`}>
                      {isChecked ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Red Flag Warning Box */}
            <div className="bg-red-950/30 border border-red-500/30 p-3 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>
                If you have chest pain, severe difficulty breathing, sudden face droop, or heavy bleeding, our engine alerts emergency doctors immediately.
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: Duration & Severity */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={20} />
              <span>{t.stepDurationSeverity}</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">{t.labelDuration}</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: '< 24 Hours', label: t.duration1Day },
                  { key: '2 - 3 Days', label: t.duration2_3Days },
                  { key: 'More than 3 Days', label: t.durationOver3Days },
                  { key: 'More than 1 Week', label: t.durationWeeks }
                ].map(d => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setFormData({ ...formData, duration: d.key })}
                    className={`p-3 rounded-xl border text-center text-xs font-semibold transition-all ${
                      formData.duration === d.key
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                        : 'bg-[#0B132B] border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {t.labelSeverity}: <span className="text-amber-400 font-bold text-sm">{formData.severity} / 5</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={formData.severity}
                onChange={e => setFormData({ ...formData, severity: e.target.value })}
                className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                <span>1 (Mild discomfort)</span>
                <span>3 (Moderate)</span>
                <span className="text-red-400">5 (Severe agony)</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Optional Vitals */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Thermometer className="text-amber-400" size={20} />
              <span>{t.stepVitals}</span>
            </h2>
            <p className="text-xs text-slate-400">
              If an ASHA worker kit, pulse oximeter, or thermometer is available, record vitals below (optional):
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Thermometer size={14} className="text-amber-400" />
                  <span>{t.labelTemperature}</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={e => setFormData({ ...formData, temperature: e.target.value })}
                  placeholder="e.g. 38.5 (°C)"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Wind size={14} className="text-sky-400" />
                  <span>{t.labelSpo2}</span>
                </label>
                <input
                  type="number"
                  value={formData.spo2}
                  onChange={e => setFormData({ ...formData, spo2: e.target.value })}
                  placeholder="e.g. 96 (%) - Below 90 triggers Emergency"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Activity size={14} className="text-teal-400" />
                  <span>{t.labelBp}</span>
                </label>
                <input
                  type="text"
                  value={formData.bp}
                  onChange={e => setFormData({ ...formData, bp: e.target.value })}
                  placeholder="e.g. 120/80"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-3 text-sm focus:border-amber-400 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Wizard Navigation Buttons */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-700">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              type="button"
              className="flex items-center gap-1.5 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              <ArrowLeft size={16} />
              <span>{t.btnBack}</span>
            </button>
          ) : <div />}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              type="button"
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
            >
              <span>{t.btnNext}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              type="button"
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer"
            >
              <span>{submitting ? 'Evaluating Triage...' : t.btnSubmitTriage}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
