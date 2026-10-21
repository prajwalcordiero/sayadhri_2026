import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, Gauge, Sliders, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { SIMULATION_PROFILES, PROFILE_CONFIGS, globalProbe } from '../network/probe.js';

export default function NetworkSimulator({ controller, isOpen, onClose }) {
  const [selectedProfile, setSelectedProfile] = useState('auto');
  const [telemetry, setTelemetry] = useState(globalProbe.lastTelemetry);
  const [sessionBytes, setSessionBytes] = useState({ sent: 48500, received: 112000 });

  useEffect(() => {
    const unsub = globalProbe.subscribe(t => {
      setTelemetry(t);
    });
    return unsub;
  }, []);

  const handleProfileSelect = (profileKey) => {
    setSelectedProfile(profileKey);
    globalProbe.setProfile(profileKey);

    if (profileKey === 'auto') {
      controller.clearForcedMode();
    } else {
      // Force controller input corresponding to profile
      const cfg = PROFILE_CONFIGS[profileKey];
      const targetMode = controller.determineRawMode({
        kbps: cfg.kbps,
        rtt: cfg.rtt,
        isOnline: cfg.isOnline
      });
      controller.setForcedMode(targetMode);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B132B] border-t-2 border-amber-500 shadow-2xl p-4 text-white max-w-4xl mx-auto rounded-t-2xl transition-all">
      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sliders className="text-amber-400" size={20} />
          <div>
            <h3 className="font-bold text-sm tracking-wide text-amber-300">
              NETWORK SIMULATOR & TELEMETRY INJECTOR
            </h3>
            <p className="text-xs text-slate-400">
              Toggle network profiles to demo live graceful degradation (Shortcut: <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-600 text-amber-400">Shift+N</kbd>)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 my-3">
        {[
          { key: 'auto', label: 'Auto (Real Net)', desc: 'Live network probe', color: 'bg-emerald-600' },
          { key: '4g', label: '4G (High Speed)', desc: '850 kbps, 80ms RTT', color: 'bg-blue-600' },
          { key: '3g', label: '3G (Rural)', desc: '220 kbps, 250ms RTT', color: 'bg-teal-600' },
          { key: '2g', label: '2G (Ghat Pass)', desc: '45 kbps, 550ms RTT', color: 'bg-amber-600' },
          { key: 'poor', label: 'Very Poor (Valley)', desc: '8 kbps, 1200ms RTT', color: 'bg-orange-700' },
          { key: 'offline', label: 'Offline (No Signal)', desc: '0 kbps, Outbox active', color: 'bg-red-700' }
        ].map(p => {
          const isSelected = selectedProfile === p.key;
          return (
            <button
              key={p.key}
              onClick={() => handleProfileSelect(p.key)}
              className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? `${p.color} border-white shadow-lg scale-102`
                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
              }`}
            >
              <span className="font-bold text-xs">{p.label}</span>
              <span className="text-[10px] text-slate-300 mt-1">{p.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Live Telemetry & Counter Bar */}
      <div className="bg-[#1C2541] rounded-xl p-3 border border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-400 block mb-0.5">Estimated Bandwidth</span>
          <span className="font-mono text-base font-bold text-amber-400">
            {telemetry.kbps} <span className="text-xs">kbps</span>
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">Round Trip Time (RTT)</span>
          <span className="font-mono text-base font-bold text-sky-400">
            {telemetry.rtt} <span className="text-xs">ms</span>
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">Active Mode</span>
          <span className="font-bold uppercase tracking-wider text-emerald-400">
            {controller.currentMode}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">Hysteresis Status</span>
          <span className="text-[11px] text-slate-300">
            {controller.candidateMode ? `Upgrade candidate: ${controller.candidateMode}...` : 'Stable'}
          </span>
        </div>
      </div>
    </div>
  );
}
