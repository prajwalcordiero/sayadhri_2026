import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Stethoscope,
  PhoneCall,
  ArrowRight,
  HardDrive,
  Info
} from 'lucide-react';

export default function TriageResult({ caseItem, triageResult, isOutboxQueued, onEnterConsultation, t }) {
  const urgency = triageResult?.urgency || caseItem?.urgency || 'Routine';
  const specialty = triageResult?.suggestedSpecialty || caseItem?.suggested_specialty || 'General Medicine';
  const reasons = triageResult?.reasons || caseItem?.triage_reasons || [];
  const emergencyAction = triageResult?.emergencyAction || caseItem?.emergency_action;

  const isEmergency = urgency === 'Emergency';
  const isUrgent = urgency === 'Urgent';

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      {/* Top Banner */}
      <div className={`p-5 rounded-2xl border shadow-xl text-white ${
        isEmergency
          ? 'bg-red-950/90 border-red-500 pulse-emergency'
          : isUrgent
          ? 'bg-amber-950/80 border-amber-500/60'
          : 'bg-emerald-950/80 border-emerald-500/60'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {isEmergency ? (
            <ShieldAlert size={28} className="text-red-400 shrink-0" />
          ) : isUrgent ? (
            <AlertTriangle size={28} className="text-amber-400 shrink-0" />
          ) : (
            <CheckCircle size={28} className="text-emerald-400 shrink-0" />
          )}

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80 block">
              {t.urgencyLevel}
            </span>
            <h1 className="text-xl sm:text-2xl font-black">
              {urgency === 'Emergency' ? t.urgencyEmergency : urgency === 'Urgent' ? t.urgencyUrgent : t.urgencyRoutine}
            </h1>
          </div>
        </div>

        {/* Emergency Call-Out Banner */}
        {isEmergency && (
          <div className="mt-3 bg-red-900/60 border border-red-400/50 p-3.5 rounded-xl">
            <div className="flex items-start gap-2.5">
              <PhoneCall className="text-white shrink-0 mt-0.5 animate-bounce" size={20} />
              <div>
                <p className="font-extrabold text-white text-sm">
                  {t.emergencyBannerTitle}
                </p>
                <p className="text-xs text-red-100 mt-1">
                  {emergencyAction || t.emergencyBannerText}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <a
                    href="tel:108"
                    className="inline-flex items-center gap-1.5 bg-white text-red-900 font-black text-xs px-3 py-1.5 rounded-lg shadow"
                  >
                    <PhoneCall size={14} />
                    <span>Call 108 Emergency Now</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {isOutboxQueued && (
          <div className="mt-3 bg-slate-900/80 border border-amber-400/40 p-2.5 rounded-lg flex items-center gap-2 text-xs text-amber-300">
            <HardDrive size={16} />
            <span>
              Network is offline or low bandwidth. Triage saved locally in Outbox and dispatched via SMS fallback.
            </span>
          </div>
        )}
      </div>

      {/* Specialty and Doctor Routing Card */}
      <div className="bg-[#1C2541] border border-slate-700 rounded-2xl p-5 text-white shadow-lg space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block mb-0.5">
              {t.assignedSpecialist}
            </span>
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <Stethoscope size={20} className="text-amber-400" />
              <span>Department of {specialty}</span>
            </h2>
          </div>
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-bold">
            Queue Priority #1
          </span>
        </div>

        {/* Explainable Reasons */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <Info size={14} className="text-sky-400" />
            <span>{t.clinicalReasons}</span>
          </h3>
          <ul className="space-y-1.5">
            {reasons.map((r, idx) => (
              <li
                key={idx}
                className="bg-[#0B132B] p-2.5 rounded-xl border border-slate-700 text-xs text-slate-200 flex items-start gap-2"
              >
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={() => onEnterConsultation(caseItem.id)}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg hover:scale-101 cursor-pointer"
          >
            <span>{t.btnEnterConsultation}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="text-center text-slate-400 text-xs p-2">
        <p>{t.disclaimer}</p>
      </div>
    </div>
  );
}
