import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import NetworkSimulator from './components/NetworkSimulator';
import StatsOverlay from './components/StatsOverlay';

import Login from './pages/Login';
import Home from './pages/Home';
import TriageWizard from './pages/TriageWizard';
import TriageResult from './pages/TriageResult';
import ConsultationRoom from './pages/ConsultationRoom';
import DoctorDashboard from './pages/DoctorDashboard';
import MyCases from './pages/MyCases';
import SmsOutbox from './pages/SmsOutbox';
import ImpactDashboard from './pages/ImpactDashboard';

import { translations } from './i18n/translations';
import { ModeController } from './network/controller';
import { globalProbe } from './network/probe';
import { getPendingOutboxItems, updateOutboxItemStatus, removeOutboxItem } from './outbox/db';
import { calculateBackoff } from './outbox/syncWorker';

// Singleton Mode Controller
const controller = new ModeController();

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('swastha_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('swastha_token') || '');
  const [lang, setLang] = useState('en');
  const [page, setPage] = useState('home');
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [activeTriageResult, setActiveTriageResult] = useState(null);
  const [activeCaseItem, setActiveCaseItem] = useState(null);
  const [isOutboxQueued, setIsOutboxQueued] = useState(false);

  // Network & UI States
  const [mode, setMode] = useState(controller.currentMode);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isStatsVisible, setIsStatsVisible] = useState(false);

  const t = translations[lang] || translations.en;

  // 1. Initialize Network Probe & Mode Controller
  useEffect(() => {
    globalProbe.start();

    // Probe feeds telemetry to controller
    const unsubProbe = globalProbe.subscribe(telemetry => {
      controller.updateTelemetry(telemetry);
    });

    // Controller updates mode state
    const unsubController = controller.subscribe(({ newMode }) => {
      setMode(newMode);
    });

    // Keyboard shortcut Shift+N for Network Simulator
    const handleKeyDown = (e) => {
      if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        setIsSimulatorOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      globalProbe.stop();
      unsubProbe();
      unsubController();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 2. Background Outbox Sync Worker with Exponential Backoff
  useEffect(() => {
    let syncTimer = null;
    let isSyncing = false;

    async function syncOutbox() {
      if (isSyncing) return;
      if (!navigator.onLine || mode === 'store-forward') return;

      isSyncing = true;
      try {
        const pendingItems = await getPendingOutboxItems();
        for (const item of pendingItems) {
          try {
            await updateOutboxItemStatus(item.id, 'sending');
            const res = await fetch(item.endpoint, {
              method: item.method || 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload)
            });

            if (res.ok) {
              await removeOutboxItem(item.id);
            } else {
              const backoff = calculateBackoff(item.attempts || 0);
              await updateOutboxItemStatus(item.id, 'failed', `HTTP ${res.status}`);
            }
          } catch (itemErr) {
            await updateOutboxItemStatus(item.id, 'pending', itemErr.message);
          }
        }
      } catch (e) {
        console.warn('Outbox sync error:', e);
      } finally {
        isSyncing = false;
      }
    }

    syncTimer = setInterval(syncOutbox, 5000);
    window.addEventListener('online', syncOutbox);

    return () => {
      clearInterval(syncTimer);
      window.removeEventListener('online', syncOutbox);
    };
  }, [mode]);

  // Handle Login
  const handleLoginSuccess = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('swastha_user', JSON.stringify(userData));
    localStorage.setItem('swastha_token', jwtToken);

    if (userData.role === 'doctor') {
      setPage('doctor-queue');
    } else {
      setPage('home');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('swastha_user');
    localStorage.removeItem('swastha_token');
    setPage('login');
  };

  // Navigation router helper
  const navigateTo = (targetPage, extraParam = null) => {
    if (extraParam) {
      setActiveCaseId(extraParam);
    }
    setPage(targetPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Triage Completion Handler
  const handleTriageCompleted = (caseItem, triageResult, queuedInOutbox) => {
    setActiveCaseItem(caseItem);
    setActiveTriageResult(triageResult);
    setIsOutboxQueued(queuedInOutbox);
    setActiveCaseId(caseItem.id);
    setPage('triage-result');
  };

  // If unauthenticated, show Login Screen
  if (!user || page === 'login') {
    return (
      <div className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col justify-between">
        <Login onLoginSuccess={handleLoginSuccess} t={t} />
        {/* Network simulator remains accessible on login for demo readiness */}
        <NetworkSimulator
          controller={controller}
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Persistent App Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'kn' : 'en')}
        mode={mode}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onToggleStats={() => setIsStatsVisible(prev => !prev)}
        onNavigate={navigateTo}
      />

      {/* Main Routed Content */}
      <main className="flex-1 pb-16">
        {page === 'home' && (
          <Home
            user={user}
            onNavigate={navigateTo}
            t={t}
            mode={mode}
          />
        )}

        {page === 'triage' && (
          <TriageWizard
            user={user}
            onCompleteTriage={handleTriageCompleted}
            t={t}
            lang={lang}
            mode={mode}
          />
        )}

        {page === 'triage-result' && (
          <TriageResult
            caseItem={activeCaseItem}
            triageResult={activeTriageResult}
            isOutboxQueued={isOutboxQueued}
            onEnterConsultation={(cid) => navigateTo('consultation', cid)}
            t={t}
          />
        )}

        {page === 'consultation' && activeCaseId && (
          <ConsultationRoom
            caseId={activeCaseId}
            user={user}
            mode={mode}
            controller={controller}
            onNavigate={navigateTo}
            t={t}
          />
        )}

        {page === 'doctor-queue' && (
          <DoctorDashboard
            user={user}
            onEnterConsultation={(cid) => navigateTo('consultation', cid)}
            t={t}
            mode={mode}
          />
        )}

        {page === 'cases' && (
          <MyCases
            user={user}
            onEnterConsultation={(cid) => navigateTo('consultation', cid)}
            t={t}
            mode={mode}
          />
        )}

        {page === 'sms' && (
          <SmsOutbox t={t} />
        )}

        {page === 'impact' && (
          <ImpactDashboard t={t} />
        )}

        {page === 'simulator' && (
          <div className="max-w-4xl mx-auto p-4 text-center">
            <h2 className="text-xl font-bold mb-3">Network Simulator</h2>
            <button
              onClick={() => setIsSimulatorOpen(true)}
              className="bg-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Open Network Simulation Drawer
            </button>
          </div>
        )}
      </main>

      {/* Footer Non-Diagnostic Prototype Disclaimer */}
      <footer className="border-t border-slate-800/80 bg-[#0B132B] py-3 px-4 text-center text-[11px] text-slate-400">
        <p>{t.disclaimer} • SwasthaSetu Rural Telemedicine Prototype</p>
      </footer>

      {/* Floating Network Simulator Drawer */}
      <NetworkSimulator
        controller={controller}
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      {/* Floating Live Telemetry & Bandwidth Stats Overlay */}
      <StatsOverlay
        controller={controller}
        isVisible={isStatsVisible}
        onClose={() => setIsStatsVisible(false)}
      />
    </div>
  );
}
