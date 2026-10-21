import test from 'node:test';
import assert from 'node:assert';
import { ModeController, MODES } from '../../client/src/network/controller.js';

test('Mode Controller - Asymmetric Hysteresis State Machine', async (t) => {
  await t.test('initializes with default video mode or specified mode', () => {
    const controller = new ModeController();
    assert.strictEqual(controller.currentMode, MODES.VIDEO);

    const audioCtrl = new ModeController({ initialMode: MODES.AUDIO });
    assert.strictEqual(audioCtrl.currentMode, MODES.AUDIO);
  });

  await t.test('immediately downgrades on bandwidth drop (Zero hysteresis)', () => {
    const controller = new ModeController({ initialMode: MODES.VIDEO });
    
    // Bandwidth drops to 150 kbps -> Audio mode
    const mode = controller.updateTelemetry({ kbps: 150, rtt: 250, isOnline: true }, 1000);
    assert.strictEqual(mode, MODES.AUDIO);
    assert.strictEqual(controller.currentMode, MODES.AUDIO);

    // Bandwidth drops further to 35 kbps -> Chat mode
    const chatMode = controller.updateTelemetry({ kbps: 35, rtt: 300, isOnline: true }, 2000);
    assert.strictEqual(chatMode, MODES.CHAT);

    // Goes offline -> Store-and-forward mode
    const offlineMode = controller.updateTelemetry({ kbps: 0, rtt: 2000, isOnline: false }, 3000);
    assert.strictEqual(offlineMode, MODES.STORE_FORWARD);
  });

  await t.test('delays upgrade until quality persists for 10 seconds (Hysteresis)', () => {
    const controller = new ModeController({ initialMode: MODES.CHAT, upgradeHysteresisMs: 10000 });

    const startTime = 100000;
    // Step 1: Bandwidth spikes to 600 kbps (video quality)
    controller.updateTelemetry({ kbps: 600, rtt: 120, isOnline: true }, startTime);
    // Should NOT upgrade immediately
    assert.strictEqual(controller.currentMode, MODES.CHAT);

    // Step 2: 5 seconds in, still high bandwidth -> still Chat
    controller.updateTelemetry({ kbps: 580, rtt: 130, isOnline: true }, startTime + 5000);
    assert.strictEqual(controller.currentMode, MODES.CHAT);

    // Step 3: 9.9 seconds in -> still Chat
    controller.updateTelemetry({ kbps: 620, rtt: 110, isOnline: true }, startTime + 9900);
    assert.strictEqual(controller.currentMode, MODES.CHAT);

    // Step 4: 10.0 seconds in -> successfully upgrades to VIDEO!
    controller.updateTelemetry({ kbps: 610, rtt: 115, isOnline: true }, startTime + 10000);
    assert.strictEqual(controller.currentMode, MODES.VIDEO);
  });

  await t.test('resets upgrade candidate timer if link drops during candidate period', () => {
    const controller = new ModeController({ initialMode: MODES.AUDIO, upgradeHysteresisMs: 10000 });
    const startTime = 100000;

    // Signal spikes to video
    controller.updateTelemetry({ kbps: 500, rtt: 150, isOnline: true }, startTime);
    assert.strictEqual(controller.currentMode, MODES.AUDIO);

    // 6 seconds later, sudden drop back to audio
    controller.updateTelemetry({ kbps: 180, rtt: 350, isOnline: true }, startTime + 6000);
    assert.strictEqual(controller.currentMode, MODES.AUDIO);
    assert.strictEqual(controller.candidateMode, null); // timer cleared
  });
});
