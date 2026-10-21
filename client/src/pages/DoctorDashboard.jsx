import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ShieldAlert,
  Clock,
  User,
  ArrowRight,
  PhoneCall,
  CheckCircle2,
  Stethoscope,
  RefreshCw,
  MapPin,
  Calendar
} from 'lucide-react';
import { io } from 'socket.io-client';

const SEEDED_CASES = [
  {
    id: 'case_seed_1_emergency',
    patient_name: 'Manjunath Patgar',
    patient_age: 58,
    patient_sex: 'male',
    patient_village: 'Gokarna Coastal Hamlet, Kumta',
    complaint_category: 'heart',
    symptoms: ['chest pain', 'severe difficulty breathing', 'cold sweats'],
    duration: '2 hours',
    severity: 5,
    vitals: { temperature: 37.0, spo2: 88, bp: '150/95' },
    urgency: 'Emergency',
    suggested_specialty: 'Cardiology',
    triage_reasons: ['Chest pain reported, immediate cardiac evaluation required', 'Critically low blood oxygen level (SpO2: 88% < 90%)'],
    consultation_mode: 'video',
    status: 'pending',
    created_at: Date.now() - 900000
  },
  {
    id: 'case_seed_2_urgent',
    patient_name: 'Tanvi Naik',
    patient_age: 4,
    patient_sex: 'female',
    patient_village: 'Devimane Ghat, Sirsi',
    complaint_category: 'child',
    symptoms: ['fever', 'persistent vomiting'],
    duration: '4 days',
    severity: 4,
    vitals: { temperature: 39.4, spo2: 96 },
    urgency: 'Urgent',
    suggested_specialty: 'Paediatrics',
    triage_reasons: ['Paediatric patient under 5 years presenting with fever', 'High body temperature measured (39.4°C)'],
    consultation_mode: 'audio',
    status: 'pending',
    created_at: Date.now() - 2700000
  },
  {
    id: 'case_seed_3_routine',
    patient_name: 'Gowramma Hegde',
    patient_age: 42,
    patient_sex: 'female',
    patient_village: 'Bilgi Village, Siddapur Taluka',
    complaint_category: 'skin',
    symptoms: ['itchy red skin lesions'],
    duration: '1 week',
    severity: 2,
    vitals: { temperature: 36.8, spo2: 98 },
    urgency: 'Routine',
    suggested_specialty: 'Dermatology',
    triage_reasons: ['Standard primary healthcare consultation; no red flags detected.'],
    consultation_mode: 'chat',
    status: 'pending',
    created_at: Date.now() - 7200000
  }
];

export default function DoctorDashboard({ user, onEnterConsultation, t, mode }) {
  const [queue, setQueue] = useState(SEEDED_CASES);
  const [selectedCase, setSelectedCase] = useState(SEEDED_CASES[0]);
  const [loading, setLoading] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`/api/cases?doctor_id=${user.id}`);
      const data = await res.json();
      if (data.success && data.cases && data.cases.length > 0) {
        setQueue(data.cases);
        if (!selectedCase) setSelectedCase(data.cases[0]);
      } else {
        setQueue(SEEDED_CASES);
        if (!selectedCase) setSelectedCase(SEEDED_CASES[0]);
      }
    } catch (e) {
      // Netlify static fallback
      setQueue(SEEDED_CASES);
      if (!selectedCase) setSelectedCase(SEEDED_CASES[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    const socket = io();
    socket.on('queue-update', () => {
      fetchQueue();
    });
    socket.on('case-updated', () => {
      fetchQueue();
    });

    return () => socket.disconnect();
  }, [user.id]);

  const emergencyCount = queue.filter(c => c.urgency === 'Emergency' && c.status !== 'completed').length;
  const urgentCount = queue.filter(c => c.urgency === 'Urgent' && c.status !== 'completed').length;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1C2541] border border-slate-700 p-4 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Stethoscope className="text-amber-400" size={24} />
            <span>Dr. {user.name}</span>
          </h1>
          <p className="text-xs text-slate-300">
            Specialty: <span className="text-amber-400 font-bold">{user.specialty}</span> • Telemedicine Triage Queue
          </p>
        </div>

        <div className="flex items-center gap-3">
          {emergencyCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-500 text-red-200 px-3 py-1.5 rounded-xl text-xs font-bold pulse-emergency">
              <ShieldAlert size={16} />
              <span>{emergencyCount} Emergency</span>
            </div>
          )}
          {urgentCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold">
              <AlertTriangle size={16} />
              <span>{urgentCount} Urgent</span>
            </div>
          )}
          <button
            onClick={fetchQueue}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Refresh Queue"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 2-Column Workstation: Left = Queue, Right = Case Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Col: Queue List */}
        <div className="bg-[#1C2541] border border-slate-700 rounded-2xl p-4 shadow-lg space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Patients Waiting in Queue</span>
            <span className="font-mono bg-slate-800 text-amber-400 px-2 py-0.5 rounded text-[11px]">
              {queue.length} Total
            </span>
          </h2>

          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading triage queue...</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No patients waiting in queue.</div>
          ) : (
            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {queue.map(c => {
                const isEmergency = c.urgency === 'Emergency';
                const isUrgent = c.urgency === 'Urgent';
                const isSelected = selectedCase?.id === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isEmergency
                        ? 'bg-red-950/40 border-red-500/80 hover:bg-red-950/60 pulse-emergency'
                        : isUrgent
                        ? 'bg-amber-950/30 border-amber-500/50 hover:bg-amber-950/50'
                        : 'bg-[#0B132B] border-slate-700 hover:border-slate-500'
                    } ${isSelected ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isEmergency ? 'bg-red-600 text-white' : isUrgent ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {c.urgency}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="font-bold text-sm text-white">
                      {c.patient_name} ({c.patient_age}y, {c.patient_sex})
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} className="text-amber-400" />
                      <span className="truncate">{c.patient_village}</span>
                    </div>

                    <div className="mt-2 text-[11px] text-amber-300 line-clamp-1 font-medium">
                      Complaint: {c.complaint_category} • Severity: {c.severity}/5
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Cols: Selected Case Diagnostic Detail */}
        <div className="md:col-span-2 bg-[#1C2541] border border-slate-700 rounded-2xl p-5 shadow-lg">
          {selectedCase ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-700 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {selectedCase.patient_name}
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      #{selectedCase.id.substring(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedCase.patient_age} yrs • {selectedCase.patient_sex} • {selectedCase.patient_village}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
                    Patient link: <strong className="text-amber-400 uppercase">{selectedCase.consultation_mode || 'video'}</strong>
                  </span>
                  <button
                    onClick={() => onEnterConsultation(selectedCase.id)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-lg transition-transform hover:scale-102 cursor-pointer"
                  >
                    <span>Start Consultation</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* Triage Evaluation Reasons */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Clinical Triage Reasons (Rule-Based)
                </h3>
                <div className="space-y-1.5">
                  {(selectedCase.triage_reasons || []).map((r, i) => (
                    <div key={i} className="bg-[#0B132B] p-2.5 rounded-lg border border-slate-700 text-xs text-slate-200">
                      • {r}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reported Symptoms & Vitals Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#0B132B] p-3 rounded-xl border border-slate-700 space-y-1">
                  <span className="text-xs font-semibold text-slate-400 block">Reported Symptoms:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedCase.symptoms || []).map((s, i) => (
                      <span key={i} className="bg-slate-800 text-amber-300 text-xs px-2 py-0.5 rounded-md font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0B132B] p-3 rounded-xl border border-slate-700 space-y-1">
                  <span className="text-xs font-semibold text-slate-400 block">Reported Vitals:</span>
                  <div className="text-xs text-slate-300 space-y-0.5 font-mono">
                    <div>Temp: {selectedCase.vitals?.temperature ? `${selectedCase.vitals.temperature}°C` : 'Not recorded'}</div>
                    <div>SpO2: {selectedCase.vitals?.spo2 ? `${selectedCase.vitals.spo2}%` : 'Not recorded'}</div>
                    <div>BP: {selectedCase.vitals?.bp || 'Not recorded'}</div>
                  </div>
                </div>
              </div>

              {/* Call to action */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onEnterConsultation(selectedCase.id)}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <span>Connect with Patient in Consultation Room</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-xs">
              Select a patient from the queue to review clinical presentation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
