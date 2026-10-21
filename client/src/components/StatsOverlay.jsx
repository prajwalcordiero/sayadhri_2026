import React, { useState, useEffect } from 'react';
import { Activity, BarChart2, X, Minimize2, Maximize2 } from 'lucide-react';
import { globalProbe } from '../network/probe.js';

export default function StatsOverlay({ controller, isVisible, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [telemetry, setTelemetry] = useState(globalProbe.lastTelemetry);
  const [sessionStats, setSessionStats] = useState({
    videoBytes: 1240000,
    audioBytes: 312000,
    chatBytes: 42000,
    storeBytes: 18000,
    degradations: 3
  });

  useEffect(() => {
    const unsub = globalProbe.subscribe(t => setTelemetry(t));
    const interval = setInterval(() => {
      // Increment live data usage based on current active mode
      const current = controller.currentMode;
      setSessionStats(prev => {
        const delta = current === 'video' ? 25000 : current === 'audio' ? 2500 : current === 'chat' ? 400 : 50;
        return {
          ...prev,
          [`${current === 'store-forward' ? 'store' : current}Bytes`]: prev[`${current === 'store-forward' ? 'store' : current}Bytes`] + delta
        };
      });
    }, 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [controller]);

  if (!isVisible) return null;

  const totalBytes = sessionStats.videoBytes + sessionStats.audioBytes + sessionStats.chatBytes + sessionStats.storeBytes;

  function formatKB(b) {
    if (b > 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
    return Math.round(b / 1024) + ' KB';
  }

  return (
    <div className="fixed top-18 right-4 z-40 bg-[#0B132B]/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-xl text-white text-xs w-72 overflow-hidden transition-all">
      <div className="bg-[#1C2541] px-3 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-1.5 font-bold text-amber-300">
          <Activity size={14} />
          <span>Live Session Bandwidth</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(!minimized)}
            className="text-slate-400 hover:text-white p-0.5"
          >
            {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-0.5">
            <X size={12} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-[#161F38] p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">Speed</span>
              <span className="font-mono font-bold text-amber-400 text-sm">{telemetry.kbps} kbps</span>
            </div>
            <div className="bg-[#161F38] p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">Latency</span>
              <span className="font-mono font-bold text-sky-400 text-sm">{telemetry.rtt} ms</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1 font-semibold">
              <span className="text-slate-300">Total Session Data:</span>
              <span className="text-emerald-400 font-mono font-bold">{formatKB(totalBytes)}</span>
            </div>
            
            {/* Progress breakdown */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${(sessionStats.videoBytes / totalBytes) * 100}%` }}
                className="bg-emerald-500"
                title="Video"
              />
              <div
                style={{ width: `${(sessionStats.audioBytes / totalBytes) * 100}%` }}
                className="bg-amber-500"
                title="Audio"
              />
              <div
                style={{ width: `${(sessionStats.chatBytes / totalBytes) * 100}%` }}
                className="bg-orange-500"
                title="Chat"
              />
              <div
                style={{ width: `${(sessionStats.storeBytes / totalBytes) * 100}%` }}
                className="bg-slate-500"
                title="Store-Forward"
              />
            </div>
          </div>

          <div className="space-y-1 text-[10px] text-slate-300 font-mono pt-1 border-t border-slate-800">
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Video
              </span>
              <span>{formatKB(sessionStats.videoBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Audio
              </span>
              <span>{formatKB(sessionStats.audioBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Chat
              </span>
              <span>{formatKB(sessionStats.chatBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Outbox / Chunk
              </span>
              <span>{formatKB(sessionStats.storeBytes)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
