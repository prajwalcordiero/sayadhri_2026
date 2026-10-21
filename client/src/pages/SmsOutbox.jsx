import React, { useState, useEffect } from 'react';
import { MessageSquare, PhoneCall, CheckCheck, RefreshCw, Smartphone, ShieldAlert } from 'lucide-react';
import { io } from 'socket.io-client';

const FALLBACK_SMS = [
  {
    id: 'sms_1',
    phone: '+91 98450 12345',
    message: '🚨 SwasthaSetu EMERGENCY Alert: Case for Manjunath Patgar tagged as EMERGENCY. Doctor & 108 Emergency response alerted.',
    status: 'delivered',
    created_at: Date.now() - 900000
  },
  {
    id: 'sms_2',
    phone: '+91 94812 33445',
    message: 'SwasthaSetu: Case for Tanvi Naik routed to Dr. Kiran Rao (Paediatrics). Queue position: 1.',
    status: 'delivered',
    created_at: Date.now() - 2700000
  }
];

export default function SmsOutbox({ t }) {
  const [messages, setMessages] = useState(FALLBACK_SMS);
  const [loading, setLoading] = useState(false);

  const fetchSMS = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success && data.notifications && data.notifications.length > 0) {
        setMessages(data.notifications);
      } else {
        setMessages(FALLBACK_SMS);
      }
    } catch (e) {
      setMessages(FALLBACK_SMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSMS();

    const socket = io();
    socket.on('sms-sent', (newSms) => {
      setMessages(prev => [newSms, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Smartphone className="text-amber-400" size={24} />
            <span>Simulated Cellular SMS Outbox</span>
          </h1>
          <p className="text-xs text-slate-400">
            Zero-internet fallback: All critical emergency triage alerts and doctor prescriptions dispatch via cellular SMS.
          </p>
        </div>

        <button
          onClick={fetchSMS}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="bg-[#1C2541] border border-slate-700 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700">
          <span>Dispatched SMS Transmissions</span>
          <span className="font-mono bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-bold">
            {messages.length} Dispatched
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading SMS logs...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">No SMS alerts dispatched yet.</div>
        ) : (
          <div className="space-y-2.5">
            {messages.map(sms => {
              const isEmergency = sms.message.includes('EMERGENCY') || sms.message.includes('🚨');

              return (
                <div
                  key={sms.id}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isEmergency
                      ? 'bg-red-950/40 border-red-500/80 text-red-100'
                      : 'bg-[#0B132B] border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-amber-400 font-bold">{sms.phone}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(sms.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <CheckCheck size={14} />
                      <span className="uppercase">{sms.status}</span>
                    </div>
                  </div>

                  <p className="text-xs font-mono tracking-tight leading-relaxed">
                    {sms.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
