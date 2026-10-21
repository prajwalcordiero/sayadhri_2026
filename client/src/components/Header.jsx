import React, { useState, useEffect } from 'react';
import { Languages, User, LogOut, HardDrive, Sliders, Activity, Bell } from 'lucide-react';
import ConnectionBadge from './ConnectionBadge';
import { getOutboxCount } from '../outbox/db.js';

export default function Header({
  user,
  onLogout,
  lang,
  onToggleLang,
  mode,
  onOpenSimulator,
  onToggleStats,
  onNavigate
}) {
  const [outboxCount, setOutboxCount] = useState(0);

  useEffect(() => {
    const checkOutbox = async () => {
      try {
        const count = await getOutboxCount();
        setOutboxCount(count);
      } catch (e) {}
    };
    checkOutbox();
    const interval = setInterval(checkOutbox, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Logo and Brand */}
        <div
          onClick={() => onNavigate('home')}
          className="cursor-pointer flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md group-hover:scale-105 transition-transform">
            ಸೇ
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">
                SwasthaSetu
              </span>
              <span className="text-xs text-amber-400 font-bold hidden sm:inline">
                ಸ್ವಾಸ್ಥ್ಯಸೇತು
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none hidden sm:block">
              Low-Bandwidth Rural Telemedicine
            </p>
          </div>
        </div>

        {/* Center: Live Connection Badge & Diagnostic Shortcuts */}
        <div className="flex items-center gap-2">
          <ConnectionBadge mode={mode} onClick={onOpenSimulator} />

          {/* Outbox badge if items pending */}
          {outboxCount > 0 && (
            <button
              onClick={() => onNavigate('cases')}
              className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-bold px-2 py-1 rounded-full animate-pulse"
              title={`${outboxCount} items saved in local outbox waiting to sync`}
            >
              <HardDrive size={12} />
              <span>{outboxCount} pending</span>
            </button>
          )}
        </div>

        {/* Right: Tools & Profile */}
        <div className="flex items-center gap-2">
          {/* Stats Overlay Toggle */}
          <button
            onClick={onToggleStats}
            title="Toggle Live Bandwidth Stats"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <Activity size={16} />
          </button>

          {/* Network Simulator Toggle */}
          <button
            onClick={onOpenSimulator}
            title="Open Network Simulator (Shift+N)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
          >
            <Sliders size={16} />
          </button>

          {/* Language Toggle: EN <-> KN */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
            title="Switch Language (English / ಕನ್ನಡ)"
          >
            <Languages size={14} />
            <span>{lang === 'en' ? 'ಕನ್ನಡ' : 'English'}</span>
          </button>

          {/* User profile / Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-700">
              <div className="hidden md:block text-right">
                <span className="block text-xs font-semibold text-slate-200 leading-tight">
                  {user.name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-amber-400 capitalize font-medium">
                  {user.role} {user.specialty ? `• ${user.specialty}` : ''}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Switch User / Logout"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-300 transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
