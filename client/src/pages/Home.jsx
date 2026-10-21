import React from 'react';
import {
  Stethoscope,
  Activity,
  FileText,
  Sliders,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Users,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export default function Home({ user, onNavigate, t, mode }) {
  const isAsha = user?.role === 'asha';
  const isDoctor = user?.role === 'doctor';

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1C2541] via-[#1E293B] to-[#0B132B] border border-amber-500/30 p-6 shadow-xl">
        <div className="relative z-10 space-y-2">
          {isAsha && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
              <Users size={14} />
              ASHA Community Health Worker Mode Active
            </span>
          )}
          {isDoctor && (
            <span className="inline-flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
              <Stethoscope size={14} />
              {user.specialty} Specialist Console
            </span>
          )}

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Namaskara, {user?.name}
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            {isDoctor
              ? 'Triage-ranked queue and tele-consultation workstation designed for low-bandwidth rural connections.'
              : 'Reliable telemedicine designed for coastal and hill talukas. Connect with specialists even on intermittent 2G signals or completely offline.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            {!isDoctor ? (
              <button
                onClick={() => onNavigate('triage')}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-lg transition-transform hover:scale-102 cursor-pointer text-sm"
              >
                <Stethoscope size={18} />
                <span>{isAsha ? 'New Assisted Patient Triage' : t.navTriage}</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('doctor-queue')}
                className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold px-5 py-3 rounded-xl shadow-lg transition-transform hover:scale-102 cursor-pointer text-sm"
              >
                <Activity size={18} />
                <span>Open Urgency Queue</span>
                <ArrowRight size={16} />
              </button>
            )}

            <button
              onClick={() => onNavigate('cases')}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold px-4 py-3 rounded-xl text-sm transition-colors cursor-pointer"
            >
              <FileText size={16} />
              <span>{t.navCases}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key Features & Demonstration Screens */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span>Core Capabilities & Hackathon Modules</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Triage / Cases */}
          <div
            onClick={() => onNavigate(isDoctor ? 'doctor-queue' : 'triage')}
            className="bg-[#1C2541]/80 hover:bg-[#1C2541] border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all shadow group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Stethoscope size={20} />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300">
              Rule-Based Triage
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Explainable clinical questionnaire with Emergency red-flags & specialty auto-routing.
            </p>
          </div>

          {/* Network Simulator */}
          <div
            onClick={() => onNavigate('simulator')}
            className="bg-[#1C2541]/80 hover:bg-[#1C2541] border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all shadow group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sliders size={20} />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300">
              Network Simulator (Shift+N)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Inject 4G, 3G, 2G, Very Poor, and Offline conditions to test graceful degradation.
            </p>
          </div>

          {/* Simulated SMS Outbox */}
          <div
            onClick={() => onNavigate('sms')}
            className="bg-[#1C2541]/80 hover:bg-[#1C2541] border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all shadow group"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <MessageSquare size={20} />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300">
              Simulated SMS Fallback
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Transparent cellular SMS outbox for zero-internet emergency dispatching.
            </p>
          </div>

          {/* Impact Dashboard */}
          <div
            onClick={() => onNavigate('impact')}
            className="bg-[#1C2541]/80 hover:bg-[#1C2541] border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all shadow group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <BarChart3 size={20} />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300">
              Impact & Data Metrics
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Live counters of consultations completed, bytes saved, and degradation survivals.
            </p>
          </div>

          {/* Doctor Queue (available for all to demo) */}
          <div
            onClick={() => onNavigate('doctor-queue')}
            className="bg-[#1C2541]/80 hover:bg-[#1C2541] border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all shadow group"
          >
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Activity size={20} />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300">
              Doctor Urgency Queue
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Urgency sorting (Emergency &gt; Urgent &gt; Routine) with pulsing red visual alerts.
            </p>
          </div>

          {/* Offline Outbox & Storage */}
          <div
            onClick={() => onNavigate('cases')}
            className="bg-[#1C2541]/80 hover:bg-[#1C2541] border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all shadow group"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300">
              Offline-First Outbox
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              IndexedDB local storage with exponential backoff & chunked resumable 16KB sync.
            </p>
          </div>
        </div>
      </div>

      {/* Demonstration Disclaimer */}
      <div className="bg-[#161F38] border border-slate-700 p-3.5 rounded-xl text-center text-xs text-slate-400">
        <p>{t.disclaimer}</p>
      </div>
    </div>
  );
}
