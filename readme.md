# 🏥 Disease Predictor — AI-Powered Diagnostic System

> An intelligent symptom analysis web app that predicts diseases using a **Random Forest ML model** and provides personalized medical guidance powered by **Google Gemini AI**.

---

**live demo** : https://disease-predictor-and-report.netlify.app/

---

## ✨ Features

- 🤖 **AI Symptom Analysis** — Random Forest classifier across 50+ diseases and 6 specialties
- 💡 **Gemini AI Advice** — Personalized do's, don'ts, home care tips & urgency level
- 📊 **Probability Bars** — Visual match scores for top 3 predicted conditions
- 🌙 **Dark / Light Mode** — Theme toggle with localStorage persistence
- 📄 **PDF Receipt** — Downloadable diagnosis report with patient info, symptoms & AI advice
- 💊 **6 Medical Categories** — Dermatology, Orthopedics, Dental, General, Neurology, Cardiology

---

## 🗂️ Project Structure

```
project/
├── backend/
│   ├── app.py          # Flask API — ML model + Gemini AI endpoints
│   ├── data.json       # Medical dataset (diseases & symptoms)
│   └── .env            # API keys (GEMINI_API_KEY)
└── frontend/
    ├── index.html      # Main UI — hero, predictor tool, footer
    ├── styles.css      # Full dark/light theme styles
    └── script.js       # App logic, API calls, PDF generation
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/disease-predictor.git
cd disease-predictor
```

### 2. Set Up the Backend

```bash
cd backend
pip install flask flask-cors scikit-learn pandas python-dotenv google-generativeai
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> Get your free Gemini API key at [aistudio.google.com](https://aistudio.google.com)

### 4. Run the Flask Server

```bash
cd backend
python app.py
```

The API will start at `http://127.0.0.1:5000`

### 5. Open the Frontend

Open `frontend/index.html` directly in your browser — no extra setup needed.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/symptoms` | Returns all categories and symptoms |
| `POST` | `/predict` | Accepts symptoms, returns top 3 disease predictions |
| `POST` | `/ai-advice` | Sends disease + patient info to Gemini AI for guidance |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Python, Flask, Flask-CORS |
| ML Model | Scikit-learn (Random Forest) |
| AI | Google Gemini 2.5 Flash |
| PDF | jsPDF (CDN) |
| Fonts | Google Fonts — Sora, DM Sans |

---

## 📋 How It Works

1. **Patient fills in** age, gender, and existing conditions
2. **Selects a medical category** (e.g. Cardiology, Neurology)
3. **Taps symptoms** — interactive pill-style selection
4. **AI analyzes** symptoms using a trained Random Forest model
5. **Results display** top 3 diagnoses with probability bars
6. **Optional:** Click *Get AI Advice* for Gemini-powered guidance
7. **Download** a styled PDF receipt with full diagnosis details

---

## ⚠️ Disclaimer

> This tool is for **educational purposes only**.  
> It is **not a substitute** for professional medical advice, diagnosis, or treatment.  
> Always consult a qualified healthcare provider for medical concerns.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).