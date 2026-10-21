import React, { useState, useEffect } from 'react';
import { User, ShieldAlert, Stethoscope, HeartPulse, Sparkles, MapPin } from 'lucide-react';

const FALLBACK_USERS = [
  { id: 'patient_1', name: 'Ramesh Gowda', role: 'patient', phone: '+91 98450 12345', specialty: null, village: 'Gokarna Coastal Hamlet' },
  { id: 'patient_2', name: 'Gowramma Hegde', role: 'patient', phone: '+91 98450 67890', specialty: null, village: 'Bilgi Village, Siddapur' },
  { id: 'asha_1', name: 'Sunitha Hegde (ASHA Worker)', role: 'asha', phone: '+91 94812 33445', specialty: null, village: 'Devimane Ghat, Sirsi' },
  { id: 'doc_cardio_1', name: 'Dr. Ananya Bhat', role: 'doctor', phone: '+91 94481 00101', specialty: 'Cardiology' },
  { id: 'doc_paed_1', name: 'Dr. Kiran Rao', role: 'doctor', phone: '+91 94481 00105', specialty: 'Paediatrics' },
  { id: 'doc_derma_1', name: 'Dr. Priya Kamath', role: 'doctor', phone: '+91 94481 00103', specialty: 'Dermatology' },
  { id: 'doc_gen_1', name: 'Dr. Mohammed Irfan', role: 'doctor', phone: '+91 94481 00108', specialty: 'General Medicine' }
];

export default function Login({ onLoginSuccess, t }) {
  const [demoUsers, setDemoUsers] = useState(FALLBACK_USERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/auth/demo-users')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users && data.users.length > 0) {
          setDemoUsers(data.users);
        }
      })
      .catch(() => {
        // Fallback to FALLBACK_USERS on static hosting (e.g. Netlify)
        setDemoUsers(FALLBACK_USERS);
      });
  }, []);

  const handleQuickLogin = async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user, data.token);
        return;
      }
    } catch (err) {
      // Netlify static fallback
      const user = FALLBACK_USERS.find(u => u.id === userId) || FALLBACK_USERS[0];
      onLoginSuccess(user, 'token_' + userId);
      return;
    } finally {
      setLoading(false);
    }
  };

  const patients = demoUsers.filter(u => u.role === 'patient');
  const ashas = demoUsers.filter(u => u.role === 'asha');
  const doctors = demoUsers.filter(u => u.role === 'doctor');

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1C2541]/90 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl mx-auto flex items-center justify-center text-slate-950 font-black text-2xl mb-3 shadow-lg">
            ಸೇ
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            SwasthaSetu
          </h1>
          <p className="text-xs text-amber-400 font-semibold mt-1">
            {t.tagline}
          </p>
          <div className="inline-flex items-center gap-1.5 bg-slate-800/80 text-slate-300 text-[11px] px-3 py-1 rounded-full border border-slate-700 mt-2">
            <MapPin size={12} className="text-amber-400" />
            <span>Coastal & Hill Talukas Tele-Health</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/80 border border-red-700 text-red-200 text-xs p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <User size={13} className="text-sky-400" />
              <span>Select Demo Account</span>
            </h2>

            {/* Quick Fill: Patients */}
            <div className="space-y-2 mb-3">
              <span className="text-[11px] font-semibold text-slate-400 block">Patient Demo:</span>
              <button
                onClick={() => handleQuickLogin('patient_1')}
                disabled={loading}
                className="w-full text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 hover:border-amber-400/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-slate-100 group-hover:text-amber-300">
                    Ramesh Gowda
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Patient • Gokarna Coastal Hamlet
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                  Login &rarr;
                </span>
              </button>
            </div>

            {/* Quick Fill: ASHA Worker */}
            <div className="space-y-2 mb-3">
              <span className="text-[11px] font-semibold text-slate-400 block">ASHA Health Worker Demo:</span>
              <button
                onClick={() => handleQuickLogin('asha_1')}
                disabled={loading}
                className="w-full text-left p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-600/40 hover:border-emerald-400 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-emerald-200 group-hover:text-emerald-100">
                    Sunitha Hegde (ASHA Worker)
                  </div>
                  <div className="text-[11px] text-emerald-300/70">
                    Assisted Triage for Villagers • Sirsi Taluka
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                  ASHA Login &rarr;
                </span>
              </button>
            </div>

            {/* Quick Fill: Doctors */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 block">Specialist Doctors Demo:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'doc_cardio_1', name: 'Dr. Ananya Bhat', spec: 'Cardiology' },
                  { id: 'doc_paed_1', name: 'Dr. Kiran Rao', spec: 'Paediatrics' },
                  { id: 'doc_derma_1', name: 'Dr. Priya Kamath', spec: 'Dermatology' },
                  { id: 'doc_gen_1', name: 'Dr. Mohammed Irfan', spec: 'General Med' }
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleQuickLogin(d.id)}
                    disabled={loading}
                    className="text-left p-2.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 hover:border-blue-400 transition-all group"
                  >
                    <div className="font-bold text-xs text-blue-200 group-hover:text-white truncate">
                      {d.name}
                    </div>
                    <div className="text-[10px] text-sky-400 font-medium">
                      {d.spec}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-[11px] text-slate-400">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
