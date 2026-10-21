import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Video, Phone, MessageSquare, HardDrive } from 'lucide-react';
import { globalProbe } from '../network/probe.js';

export default function ConnectionBadge({ mode, onClick }) {
  const [telemetry, setTelemetry] = useState(globalProbe.lastTelemetry);

  useEffect(() => {
    return globalProbe.subscribe(t => setTelemetry(t));
  }, []);

  const getBadgeConfig = () => {
    switch (mode) {
      case 'video':
        return {
          bg: 'bg-emerald-950/80',
          border: 'border-emerald-500/50',
          dot: 'bg-emerald-400',
          text: 'text-emerald-300',
          label: 'Video',
          icon: Video
        };
      case 'audio':
        return {
          bg: 'bg-amber-950/80',
          border: 'border-amber-500/50',
          dot: 'bg-amber-400',
          text: 'text-amber-300',
          label: 'Audio',
          icon: Phone
        };
      case 'chat':
        return {
          bg: 'bg-orange-950/80',
          border: 'border-orange-500/50',
          dot: 'bg-orange-400',
          text: 'text-orange-300',
          label: 'Chat',
          icon: MessageSquare
        };
      case 'store-forward':
      default:
        return {
          bg: 'bg-slate-800/90',
          border: 'border-slate-600',
          dot: 'bg-slate-400',
          text: 'text-slate-300',
          label: 'Offline / Outbox',
          icon: HardDrive
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      title="Click to open Network Simulator (Shift+N)"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} ${config.border} ${config.text} text-xs font-semibold backdrop-blur-md transition-all hover:scale-105 cursor-pointer shadow-sm`}
    >
      <span className="relative flex h-2 w-2">
        {mode !== 'store-forward' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
      </span>
      <Icon size={13} />
      <span>{config.label}</span>
      <span className="opacity-60 text-[10px] font-mono border-l border-white/20 pl-1.5">
        {telemetry.kbps > 0 ? `${telemetry.kbps} kbps` : '0 kbps'}
      </span>
    </button>
  );
}
