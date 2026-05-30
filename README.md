# CurbSpace IQ | Municipal Zoning & Micro-Revenue Dashboard

**CurbSpace IQ** is a flawless, production-grade pilot prototype designed for municipal urban planners. This dashboard enables the Greater Chennai Corporation (GCC) to manage street vendor placements, perform automated AI zoning compliance, and visualize micro-revenues in real-time.

---

## 🎨 Chennai Target Municipal Zones (GCC)
The dashboard maps three key high-density transit and wholesale nodes in Chennai, India:
1. **T. Nagar** (Pondy Bazaar area) - High evening turnover retail & filter coffee/dosa transit hub.
2. **Thiruvanmiyur** (Beach/RTO area) - Steady coastal afternoon leisure and tourist traffic.
3. **Parrys Corner** (Broadway/George Town area) - Heavy wholesale market setup and multimodal transit exchange coordinates.

---

## 🛠️ Key Architectural Features & Engine Layers

### 1. Zero-Dependency High-Contrast Design
* Default Dark Mode theme using Deep Slate backgrounds (`#0F172A`), Slate Gray card containers (`#1E293B`), Off-White primary text (`#F8FAFC`), and Indigo highlights (`#6366F1`).
* Dynamic body-level class overrides (`light-theme`/`light-mode`) that switch color tokens instantly to a sleek Light Mode theme.
* Semantic color-coded badges matching NITI standards: Permitted/Success (`#10B981`), Available/Info (`#0EA5E9`), and Zoning Violation/Danger (`#EF4444`).
* A custom `@keyframes pulse-warning` micro-animation applying a soft, rhythmic crimson shadow layer to active zoning violations.

### 2. Leaflet Asynchronous Popup Charts (The Performance Fix)
* Instead of mounting Chart.js canvases inside maps during page load (which triggers layout clipping and rendering bugs), an asynchronous callback is hooked to the Leaflet marker's `popupopen` event.
* This callback dynamically locates the popup's canvas element inside the newly rendered DOM overlay and paints a custom, responsive Line Chart detailing local morning, afternoon, and evening performance data.

### 3. GCC AI Zoning Proposal Evaluator
* An interactive shopkeeper submission form inside the control panel sidebar.
* Simulates rule-based AI zoning evaluation parsing vendor type, spatial placement coordinates (plaza, pedestrian pathway, crosswalk ramp overlap, or fire hydrant safety perimeters), and desired operating timeframe.
* Renders a highly visual, color-coded response card in the sidebar indicating **`🟢 APPROVED (OK)`** or **`🔴 REJECTED (NOT OK)`** with specific, structured clearance compliance reasons.

### 4. Dynamic Time-Sharing Pitch (Double-Leasing Permits)
* In Parrys Corner (Zone 3), physical spot coordinates with ID **`CV-ST-105`** dynamically share permits based on the active timeframe.
* During the day, the ledger and markers lease the spot to a **"Day-Shift Apparel Store"** (Apparel).
* Switch the timeframe slider to **"Evening Peak"**, and the database matrix re-leases the same spot to a night-shift **"Night-Shift Street Food"** (Food Joint), successfully demonstrating a model for doubling municipal permit revenues on the exact same physical spatial coordinates.

### 5. Compliance Escalation System
* Active violations in the analytics table ledger feature a high-contrast red **`Escalate`** button.
* When clicked, the dispatcher logs a formal, timestamped enforcement alert directly to the scrollable Operations Log and transmits a digital citation alert to the Greater Chennai Corporation (GCC) field enforcement units.

---

## 🧪 System Validation Test Scenarios

### Test Case 1: Commuter Morning Rush (T. Nagar Peak Shift)
* **Action**: Choose **"T. Nagar"** and slide the Simulated Timeframe to **"Morning Rush"**.
* **Behavior**: Traffic index spikes to **`95/100`** ("Heavy Commute"). Base idli/dosa breakfast food joint revenues and traditional filter coffee stand revenues spike by **`1.5x`** dynamically in the GDP aggregates, popups, and ledger list, while artisan craft tables drop to zero utility.

### Test Case 2: Sidewalk Encroachment (AI Vision Compliance Alert)
* **Action**: Toggle **"Zoning Violations Only"** to **Active**.
* **Behavior**: All safe pitches are filtered out. Violation markers on the map turn red. Clicking them displays compliance details, e.g. `"Vendor cart blocking pedestrian flow line detected via camera feed index #48."` The Alerts card registers warnings, changes color, and pulses with warning states.

### Test Case 3: Micro-Solar Allocator (Thiruvanmiyur Solar Optimization)
* **Action**: Choose **"Thiruvanmiyur"** and slide Sim Timeframe to **"Afternoon Lull"**.
* **Behavior**: At least 2 available (Blue) spots (`PITCH-CHN-203` and `PITCH-CHN-206`) display a gold badge labeled **`☀️ High Solar Yield - Ideal for Electric Carts`** in the data ledger table and map popup tooltips, demonstrating sustainable vendor incentives.

### Test Case 4: Time-Sharing Pitch (Double-Leasing Validation)
* **Action**: Select **"Parrys Corner"** and cycle the timeframe slider between **"Afternoon Lull"** (2:00 PM) and **"Evening Peak"** (8:00 PM).
* **Behavior**: Physical spot **`CV-ST-105`** shifts dynamically from a day-shift apparel store to a night-shift street food stand on the exact same coordinates.

---

## 📂 File Structure
* `index.html` - Minimal, semantic layout structure using a dual-panel workflow.
* `styles.css` - Dense, corporate, high-contrast UI theme variables and modern layout grids.
* `script.js` - Zero-dependency core simulation engine, data layer logic, and event listeners.
* `.gitignore` - Ignored environment files, node packages, and API keys.

---

## 🚀 Local Execution & Development Setup

Since the dashboard is zero-dependency and utilizes public CDN assets (Tailwind CSS, Leaflet.js, and Chart.js), no local compilation or build server is required.

1. Clone this repository:
   ```bash
   git clone https://github.com/balachandarchinta/CurbSpace-IQ.git
   ```
2. Double-click the `index.html` file inside the repository folder to open it in your default web browser, or serve it using a lightweight dev server:
   ```bash
   npx live-server
   ```

---

## 🔒 Security & API Key Protection

To protect sensitive API tokens or secrets if you choose to integrate actual cloud databases (e.g. real Vertex AI or Google Maps endpoints) in the future:
1. Ensure all secrets are stored inside a local `.env` file at the repository root.
2. The `.gitignore` file has been pre-configured to ignore `.env`, `.env.local`, and other credential logs so they are never committed to the remote repository.
3. Access secrets on your backend server or build pipeline using standard environment loaders (`process.env`).
