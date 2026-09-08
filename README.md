# BioEye (Deterministic Telemetry & Triage Engine)

A privacy-first, non-diagnostic physiological telemetry analysis engine and mobile client. **BioEye** pairs a React Native / Expo cross-platform frontend with a high-throughput FastAPI backend to extract visual biomarkers and classify gastrointestinal telemetry data via Google Gemini Flash.

The engine uses a deterministic three-phase pipeline—combining artifact mitigation, multi-spectral biomarker extraction, and boolean triage logic—to ensure safe, structured, and reproducible state classification without relying on free-form clinical LLM diagnosis.

https://github.com/user-attachments/assets/49fb02fe-0e43-42b5-a5d4-d1f4650c2902

---

## ⚡ Key Architecture & Features

* **Multi-Stage Telemetry Pipeline:** 
  1. **Phase 1 (Artifact Mitigation):** Validates image focus, signal-to-noise ratio, glare, and spatial resolution before parsing.
  2. **Phase 2 (Multi-Spectral Telemetry Extraction):** Maps sample metrics into structured markdown matrix blocks (Bristol Stool Scale typing, color spectral analysis, hydration indices, and presence of foreign artifacts).
  3. **Phase 3 (Deterministic Triage Rules):** Enforces boolean algorithmic safety barriers to classify states into clear risk tiers (`NORMAL`, `MONITOR`, `ATTENTION_REQUIRED`, `IMMEDIATE_ACTION`) using deterministic regex parsing.
* **Client-Side Privacy Obfuscation:** Built-in mobile privacy masks blur sensitive visual biological matter on-device before preview rendering.
* **Secure Multi-Tenant Authentication:** Password hashing via `passlib[bcrypt]`, JWT-based token issuance, and scoped SQLite ORM persistence.
* **Non-Diagnostic Safety Design:** Structured entirely around objective physiological visual metrics, strictly preventing ungrounded diagnostic claims.

---

## 📂 Project Structure

```text
.
├── bioeye-app/             # Expo / React Native mobile application
│   ├── app/                # File-based routing and screens
│   ├── components/         # UI elements, camera inputs & privacy masks
│   └── package.json        # Frontend dependencies
├── main.py                 # FastAPI application endpoints & analysis routes
├── database.py             # SQLite database engine & session initialization
├── models.py               # SQLAlchemy ORM schemas & telemetry logs
├── auth.py                 # JWT generation, token verification & password hashing
├── test_triage_vision.py   # CLI telemetry testing harness for Gemini vision
├── requirements.txt        # Python backend dependencies
└── README.md
```

---

## 🛠️ Tech Stack

* **Backend:** Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Pydantic v2
* **Computer Vision & AI:** Google Gemini Flash (`google-genai` SDK), Pillow
* **Frontend:** React Native, Expo, TypeScript
* **Security:** PyJWT, bcrypt, `.env` scoped secrets
* **Storage:** SQLite (local development / testing)

---

## 🚀 Getting Started

### Prerequisites

* Python 3.10+
* Node.js 18+ and `npm`
* A Google Gemini Developer API key from [Google AI Studio](https://aistudio.google.com/)

---

### 1. Backend Setup

1. **Navigate to the root directory and create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   ```

2. **Install backend dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   SECRET_KEY=your_secure_random_jwt_secret_key
   ```

4. **Start the FastAPI backend server:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   * The API will be available at `http://localhost:8000`
   * Interactive Swagger docs can be accessed at `http://localhost:8000/docs`

---

### 2. Frontend Setup (Expo App)

1. **Navigate to the frontend application directory:**
   ```bash
   cd bioeye-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Expo development server:**
   ```bash
   npx expo start
   ```
   * Scan the QR code using the **Expo Go** app on iOS or Android, or press `w` to launch the web client.

---

### 3. Running Telemetry CLI Tests

To verify vision pipeline extraction on a test image from the command line:

```bash
python test_triage_vision.py path/to/sample_image.jpg
```

---

## 🔮 Roadmap

- [ ] **Multi-Spectral Spatial Gradient Preprocessing:** Pre-compute discrete hex-gradient distributions and color-space boundaries prior to vectorization.
- [ ] **Offline Edge Inference:** Lightweight on-device visual artifact filtering before transmission.
- [ ] **Longitudinal Telemetry Trend Reports:** Multi-week aggregate graphing of hydration and consistency variations.

---

## 📄 License & Intellectual Property

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

### Commercial Licensing
For commercial use, proprietary closed-source deployments, enterprise integrations, or SaaS exemptions that bypass AGPLv3 copyleft requirements, please contact:

📩 **`bioeye@lemesa.io`**
