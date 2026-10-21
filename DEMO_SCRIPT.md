# ⏱️ SwasthaSetu (ಸ್ವಾಸ್ಥ್ಯಸೇತು) — 3.5-Minute Live Judge Demo Script

> **Goal**: Demonstrate how SwasthaSetu enables uninterrupted telemedicine for coastal & hill talukas under unstable cellular coverage, graceful degradation, rule-based triage, and offline-first data synchronization.

---

## 🎯 Script Timeline & Click-by-Click Guide

### Part 1: Context & Login (0:00 - 0:30)
1. **Open the App**: Open [http://localhost:5173](http://localhost:5173).
2. **Explain the Challenge**:
   > *"In coastal talukas like Gokarna and hill regions like Sirsi, patients travel hours for specialist care. Standard telemedicine apps abort when bandwidth drops below 300 kbps. In SwasthaSetu, a consultation never dies."*
3. **Show Demo Accounts**:
   - Point out the demo buttons: Patient (**Ramesh Gowda**), ASHA Health Worker (**Sunitha Hegde**), and Specialists (**Cardiology, Paediatrics, Dermatology**).
4. **Log In**: Click **Patient Demo: Ramesh Gowda**.

---

### Part 2: Rule-Based Clinical Triage & 108 Alert (0:30 - 1:15)
1. **Language Toggle**:
   - In the top header, click **ಕನ್ನಡ** to show full Kannada localization, then toggle back to **English**.
2. **Start Consultation**: Click **"New Consultation"** (or **"Start New Consultation"**).
3. **Triage Wizard Flow**:
   - **Step 1 (Patient Details)**: Notice prefilled village *"Gokarna Coastal Hamlet"*. Click **Next Step**.
   - **Step 2 (Primary Complaint)**: Select **Heart & Chest Pain** (notice high-contrast tap target). Click **Next Step**.
   - **Step 3 (Symptoms)**: Select **"chest pain"** and **"severe difficulty breathing"**. Click **Next Step**.
   - **Step 4 (Duration & Severity)**: Select **"2 - 3 Days"** and slide severity to **5 / 5**. Click **Next Step**.
   - **Step 5 (Optional Vitals)**: Enter SpO2 as **88%** (critically low). Click **Complete Triage & Find Specialist**.
4. **Explain Triage Evaluation**:
   - Show the prominent red **EMERGENCY MEDICAL ALERT** banner with the **"Call 108"** dispatch button.
   - Explain: *"This is deterministic, explainable clinical logic, not a hallucinating LLM. It shows exact reasons: Chest pain reported, SpO2 88% < 90%."*
   - Point out the routing: automatically assigned to **Cardiology** (Dr. Ananya Bhat).
5. **Enter Consultation**: Click **"Enter Consultation Room"**.

---

### Part 3: Live Consultation & Graceful Degradation (1:15 - 2:30)
1. **Consultation Room**:
   - Show the room interface: WebRTC video stream on the left, interactive chat on the right, and the top **Connection Badge** showing `Video (850 kbps)`.
2. **Send a Chat Message**:
   - Type *"Namaskara Doctor, I am experiencing acute chest tightness."* and click **Send**.
3. **Open Network Simulator**:
   - Press **`Shift+N`** (or click the green Connection Badge) to open the **Network Simulator Drawer**.
4. **Demonstrate Video &rarr; Audio Degradation (3G / 2G)**:
   - Click the **`2G (Ghat Pass)`** button (45 kbps, 550ms RTT).
   - **Watch the Magic**:
     - The video camera immediately powers down to conserve cellular bandwidth.
     - The room switches seamlessly to an **Opus Audio Call** (16-24 kbps).
     - A banner announces: *"Mode shifted to AUDIO: Link degraded"*.
     - The call **did not drop**.
5. **Demonstrate Audio &rarr; Chat &rarr; Store-and-Forward (Offline)**:
   - In the simulator, click **`Offline (No Signal)`**.
   - The connection badge turns grey: `Offline / Outbox (0 kbps)`.
   - Send another message: *"Doctor, the signal is dropping in the valley."*
   - Point out: The message is instantly stored in **IndexedDB local outbox** with a clock icon.
6. **Demonstrate Network Recovery**:
   - In the simulator, click **`4G (High Speed)`**.
   - Point out the **Asymmetric Hysteresis**:
     - Upgrades require sustained quality so erratic signal doesn't flap.
     - Once stable, the system upgrades back and the outbox automatically empties and syncs.

---

### Part 4: On-Device Image Compression & Resumable Upload (2:30 - 3:00)
1. **Camera Icon**:
   - In the chat bar, click the **Camera icon**.
   - Select or take any photo.
2. **Highlight the Compression Metric**:
   - Watch the client canvas compress the photo into WebP (<100 KB).
   - Point to the badge: *"Original 3.2 MB &rarr; Sent 78 KB (97% bandwidth saved)"*.
   - Mention: *"Uploaded in resilient 16 KB chunks so interrupted connections resume without restarting."*

---

### Part 5: Cellular SMS Fallback & Impact Dashboard (3:00 - 3:30)
1. **Leave Room**: Click **"Leave Room"** and return to **Home**.
2. **Show Simulated SMS Outbox**:
   - Click **"Simulated SMS Fallback"**.
   - Show the dispatched cellular alert: *"SwasthaSetu EMERGENCY Alert: Case for Ramesh Gowda tagged as EMERGENCY. Doctor & 108 Emergency response alerted."*
   - Explain: *"When high-speed data fails completely, cellular SMS reaches the patient and ASHA worker."*
3. **Show Impact Dashboard**:
   - Click **"Impact & Data Metrics"** in the navigation.
   - Point to the live counters:
     - **Consultations Saved**: 14+ preserved during network collapse.
     - **Bandwidth Savings**: ~88% reduction vs. standard unconstrained video.
     - **Avg Data / Patient**: ~240 KB per consultation, perfectly fitting rural 2G mobile packs.

---

## 🏆 Key Takeaways for Judges

1. **Uninterrupted Care**: The patient is never left stranded with a blank screen or a dropped call.
2. **Tailored for Coastal & Hill Talukas**: Handles real-world terrain challenges like heavy monsoon rain, valley dead-zones, and ghat section towers.
3. **No Expensive Hardware or API Subscriptions**: Runs anywhere with zero API keys on any standard browser.
