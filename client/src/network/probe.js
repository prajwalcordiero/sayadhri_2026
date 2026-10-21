/**
 * SwasthaSetu Continuous Network Probe
 * Periodically measures real or simulated network quality (RTT, kbps, quality label).
 */

export const SIMULATION_PROFILES = {
  AUTO: 'auto',
  FOUR_G: '4g',
  THREE_G: '3g',
  TWO_G: '2g',
  VERY_POOR: 'poor',
  OFFLINE: 'offline'
};

export const PROFILE_CONFIGS = {
  '4g': { kbps: 850, rtt: 80, isOnline: true, label: '4G Broadband' },
  '3g': { kbps: 220, rtt: 250, isOnline: true, label: '3G Rural' },
  '2g': { kbps: 45, rtt: 550, isOnline: true, label: '2G Edge' },
  'poor': { kbps: 8, rtt: 1200, isOnline: true, label: 'Intermittent Hill Valley' },
  'offline': { kbps: 0, rtt: 9999, isOnline: false, label: 'Completely Offline' }
};

export class NetworkProbe {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 3000;
    this.timer = null;
    this.listeners = new Set();
    this.activeProfile = SIMULATION_PROFILES.AUTO;
    this.lastTelemetry = {
      kbps: 800,
      rtt: 90,
      isOnline: navigator.onLine !== false,
      quality: 'Good',
      profile: 'auto',
      timestamp: Date.now()
    };
  }

  setProfile(profile) {
    this.activeProfile = profile;
    this.sampleNow();
  }

  start() {
    if (this.timer) return;
    this.sampleNow();
    this.timer = setInterval(() => this.sampleNow(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.lastTelemetry);
    return () => this.listeners.delete(listener);
  }

  async sampleNow() {
    // 1. If simulated profile is active, use calibrated synthetic telemetry
    if (this.activeProfile !== SIMULATION_PROFILES.AUTO && PROFILE_CONFIGS[this.activeProfile]) {
      const cfg = PROFILE_CONFIGS[this.activeProfile];
      // Add slight jitter for realism (±5%)
      const jitterKbps = cfg.kbps > 0 ? Math.round(cfg.kbps * (0.95 + Math.random() * 0.1)) : 0;
      const jitterRtt = cfg.isOnline ? Math.round(cfg.rtt * (0.95 + Math.random() * 0.1)) : 9999;

      this.lastTelemetry = {
        kbps: jitterKbps,
        rtt: jitterRtt,
        isOnline: cfg.isOnline,
        quality: this._getQualityLabel(jitterKbps, cfg.isOnline),
        profile: this.activeProfile,
        timestamp: Date.now()
      };
      this._notify();
      return this.lastTelemetry;
    }

    // 2. Real Network Measurement
    if (navigator.onLine === false) {
      this.lastTelemetry = {
        kbps: 0,
        rtt: 9999,
        isOnline: false,
        quality: 'Offline',
        profile: 'auto',
        timestamp: Date.now()
      };
      this._notify();
      return this.lastTelemetry;
    }

    try {
      // Step A: Ping for RTT
      const pingStart = performance.now();
      const pingRes = await fetch('/api/ping', { cache: 'no-store' });
      const pingElapsed = performance.now() - pingStart;
      if (!pingRes.ok) throw new Error('Ping failed');

      // Step B: Probe download for throughput
      const probeStart = performance.now();
      const probeRes = await fetch('/api/probe', { cache: 'no-store' });
      if (!probeRes.ok) throw new Error('Probe failed');
      const blob = await probeRes.blob();
      const probeElapsedSec = (performance.now() - probeStart) / 1000;
      
      const bytes = blob.size;
      const bits = bytes * 8;
      let calculatedKbps = probeElapsedSec > 0 ? Math.round(bits / probeElapsedSec / 1000) : 500;

      // Cross-reference with Network Information API if supported
      if (navigator.connection && navigator.connection.downlink) {
        const navigatorKbps = Math.round(navigator.connection.downlink * 1000);
        // Weighted combination: 70% probe, 30% OS report
        calculatedKbps = Math.round(calculatedKbps * 0.7 + navigatorKbps * 0.3);
      }

      this.lastTelemetry = {
        kbps: calculatedKbps,
        rtt: Math.round(pingElapsed),
        isOnline: true,
        quality: this._getQualityLabel(calculatedKbps, true),
        profile: 'auto',
        timestamp: Date.now()
      };
    } catch (err) {
      // Failed network request indicates dropped connection
      this.lastTelemetry = {
        kbps: 0,
        rtt: 2500,
        isOnline: false,
        quality: 'Unstable / Offline',
        profile: 'auto',
        timestamp: Date.now()
      };
    }

    this._notify();
    return this.lastTelemetry;
  }

  _getQualityLabel(kbps, isOnline) {
    if (!isOnline || kbps < 10) return 'Offline / Critical';
    if (kbps < 64) return 'Very Poor (Chat Only)';
    if (kbps < 400) return 'Low Bandwidth (Audio Only)';
    return 'Good (Video Supported)';
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.lastTelemetry);
      } catch (e) {
        console.error('Error in network probe listener:', e);
      }
    }
  }
}

export const globalProbe = new NetworkProbe();
