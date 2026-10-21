import React, { useState, useEffect } from 'react';
import { FileText, ArrowRight, Clock, HardDrive, RefreshCw, User, MapPin } from 'lucide-react';
import { getLocalCases, saveCasesLocally } from '../outbox/db.js';

export default function MyCases({ user, onEnterConsultation, t, mode }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineSource, setIsOfflineSource] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    // 1. Try fetching from offline IndexedDB first
    try {
      const cached = await getLocalCases();
      if (cached && cached.length > 0) {
        setCases(cached);
      }
    } catch (e) {}

    // 2. Fetch from API if online
    if (navigator.onLine && mode !== 'store-forward') {
      try {
        const queryParam = user.role === 'doctor' ? `doctor_id=${user.id}` : `patient_id=${user.id}`;
        const res = await fetch(`/api/cases?${queryParam}`);
        const data = await res.json();
        if (data.success) {
          setCases(data.cases);
          setIsOfflineSource(false);
          await saveCasesLocally(data.cases);
        }
      } catch (err) {
        setIsOfflineSource(true);
      }
    } else {
      setIsOfflineSource(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCases();
  }, [user.id]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <FileText className="text-amber-400" size={22} />
            <span>{t.navCases}</span>
          </h1>
          <p className="text-xs text-slate-400">
            {isOfflineSource ? 'Viewing from local offline cache (IndexedDB)' : 'Live synchronized case records'}
          </p>
        </div>

        <button
          onClick={loadCases}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {isOfflineSource && (
        <div className="bg-slate-800/90 border border-slate-600 p-2.5 rounded-xl text-xs text-amber-300 flex items-center gap-2">
          <HardDrive size={16} />
          <span>Offline Storage Active: All records and pending outbox items are preserved on this device.</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="bg-[#1C2541] border border-slate-700 rounded-2xl p-8 text-center text-slate-400 text-xs">
          No previous cases recorded. Tap "New Consultation" to start a symptom triage.
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map(c => {
            const isEmergency = c.urgency === 'Emergency';
            const isUrgent = c.urgency === 'Urgent';

            return (
              <div
                key={c.id}
                onClick={() => onEnterConsultation(c.id)}
                className="bg-[#1C2541] hover:bg-[#1E293B] border border-slate-700 hover:border-amber-400/50 p-4 rounded-xl cursor-pointer transition-all shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      isEmergency ? 'bg-red-600 text-white' : isUrgent ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {c.urgency}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      #{c.id.substring(0, 8)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-amber-300">
                    {c.patient_name} ({c.patient_age}y, {c.patient_sex})
                  </h3>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="text-amber-400" />
                    <span>{c.patient_village}</span>
                    <span className="text-slate-500 ml-2">Specialty: {c.suggested_specialty}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                    c.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {c.status}
                  </span>
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:text-amber-400 group-hover:bg-slate-700 transition-colors">
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
