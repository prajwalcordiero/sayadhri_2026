/**
 * SwasthaSetu Adaptive Mode Controller with Asymmetric Hysteresis
 * 
 * Rules:
 * - Downgrade IMMEDIATELY upon bandwidth drop or latency spike to prevent call drop
 * - Upgrade ONLY after link quality stays consistently high for at least 10 seconds
 * 
 * Modes:
 * - 'video': > 400 kbps, RTT < 400 ms
 * - 'audio': 64 - 400 kbps (or RTT 400-800 ms)
 * - 'chat': 10 - 64 kbps (or RTT > 800 ms)
 * - 'store-forward': < 10 kbps or offline
 */

export const MODES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  CHAT: 'chat',
  STORE_FORWARD: 'store-forward'
};

export const MODE_RANKS = {
  'store-forward': 0,
  'chat': 1,
  'audio': 2,
  'video': 3
};

export class ModeController {
  constructor(options = {}) {
    this.currentMode = options.initialMode || MODES.VIDEO;
    this.upgradeHysteresisMs = options.upgradeHysteresisMs ?? 10000; // 10s default
    this.candidateMode = null;
    this.candidateSince = null;
    this.listeners = new Set();
    this.forcedMode = null; // for Network Simulator
    this.lastTransitionReason = 'Initial mode';
  }

  // Force mode (used by network simulator e.g. 4G, 2G, Offline)
  setForcedMode(mode) {
    this.forcedMode = mode;
    if (mode && mode !== this.currentMode) {
      const prev = this.currentMode;
      this.currentMode = mode;
      this.lastTransitionReason = `Simulator override: ${mode}`;
      this._emitChange(mode, prev, this.lastTransitionReason);
    }
  }

  clearForcedMode() {
    this.forcedMode = null;
  }

  // Determine ideal raw mode given telemetry sample
  determineRawMode({ kbps, rtt, isOnline = true }) {
    if (!isOnline || kbps < 10) {
      return MODES.STORE_FORWARD;
    }
    if (kbps < 64 || rtt > 800) {
      return MODES.CHAT;
    }
    if (kbps < 400 || rtt > 400) {
      return MODES.AUDIO;
    }
    return MODES.VIDEO;
  }

  /**
   * Feed new telemetry sample into state machine.
   * currentTimeMs allows deterministic unit testing.
   */
  updateTelemetry(telemetry, currentTimeMs = Date.now()) {
    if (this.forcedMode) {
      return this.currentMode;
    }

    const rawMode = this.determineRawMode(telemetry);
    const currentRank = MODE_RANKS[this.currentMode];
    const rawRank = MODE_RANKS[rawMode];

    // CASE 1: Downgrade required -> IMMEDIATE transition (Zero hysteresis)
    if (rawRank < currentRank) {
      const prev = this.currentMode;
      this.currentMode = rawMode;
      this.candidateMode = null;
      this.candidateSince = null;
      this.lastTransitionReason = `Link degraded to ${Math.round(telemetry.kbps || 0)} kbps (${Math.round(telemetry.rtt || 0)}ms RTT)`;
      this._emitChange(this.currentMode, prev, this.lastTransitionReason);
      return this.currentMode;
    }

    // CASE 2: Candidate for upgrade -> Must persist for upgradeHysteresisMs (10s)
    if (rawRank > currentRank) {
      if (this.candidateMode !== rawMode) {
        this.candidateMode = rawMode;
        this.candidateSince = currentTimeMs;
      } else {
        const sustainedDuration = currentTimeMs - this.candidateSince;
        if (sustainedDuration >= this.upgradeHysteresisMs) {
          const prev = this.currentMode;
          this.currentMode = rawMode;
          this.candidateMode = null;
          this.candidateSince = null;
          this.lastTransitionReason = `Connection sustained at ${Math.round(telemetry.kbps)} kbps for ${Math.round(sustainedDuration / 1000)}s`;
          this._emitChange(this.currentMode, prev, this.lastTransitionReason);
        }
      }
      return this.currentMode;
    }

    // CASE 3: Same rank -> Reset pending candidate since link no longer exceeds current mode
    if (this.candidateMode) {
      this.candidateMode = null;
      this.candidateSince = null;
    }

    return this.currentMode;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emitChange(newMode, oldMode, reason) {
    for (const listener of this.listeners) {
      try {
        listener({ newMode, oldMode, reason });
      } catch (e) {
        console.error('Error in mode controller listener:', e);
      }
    }
  }
}
