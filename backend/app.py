from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import json
import os
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import numpy as np
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)
CORS(app)
@app.route("/")
def home():
    return jsonify({
        "status": "Disease Predictor API is running",
        "endpoints": [
            "/predict",
            "/ai-advice",
            "/symptoms"
        ]
    })

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-2.5-flash")
else:
    gemini_model = None

# ── 1. Load Data ────────────────────────────────────────────────────────────
with open('data.json', 'r', encoding='utf-8') as f:
    medical_data = json.load(f)

# ── 2. Build Training Dataset ────────────────────────────────────────────────
all_symptoms = set()
for category in medical_data['categories']:
    for symptom in category['symptoms_list']:
        all_symptoms.add(symptom)

all_symptoms = sorted(list(all_symptoms))  # Sorted for consistency

rows = []
for category in medical_data['categories']:
    for disease in category['diseases']:
        row = {s: (1 if s in disease['symptoms'] else 0) for s in all_symptoms}
        row['Disease'] = disease['name']
        row['Category'] = category['name']
        row['Severity'] = disease.get('severity', 'Unknown')
        rows.append(row)

df = pd.DataFrame(rows)

# ── 3. Train Model (Random Forest - stronger than Decision Tree) ─────────────
X = df[all_symptoms]
y = df['Disease']

le = LabelEncoder()
y_encoded = le.fit_transform(y)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=None,
    random_state=42,
    min_samples_split=2
)
model.fit(X, y_encoded)

# Disease → severity map for quick lookup
disease_severity_map = {
    row['Disease']: row['Severity'] for _, row in df.iterrows()
}
disease_category_map = {
    row['Disease']: row['Category'] for _, row in df.iterrows()
}

# ── 4. Predict Endpoint ──────────────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    user_input = request.json  # {"itching": 1, "fever": 0, ...}

    # Build input vector
    input_vector = np.array([[user_input.get(s, 0) for s in all_symptoms]])

    # Get probability for ALL classes
    proba = model.predict_proba(input_vector)[0]

    # Get top 3 predictions
    top_indices = np.argsort(proba)[::-1][:3]
    results = []
    for idx in top_indices:
        disease_name = le.inverse_transform([idx])[0]
        confidence = round(float(proba[idx]) * 100, 1)
        results.append({
            "disease": disease_name,
            "probability": confidence,
            "severity": disease_severity_map.get(disease_name, "Unknown"),
            "category": disease_category_map.get(disease_name, "Unknown")
        })

    return jsonify({
        "predictions": results,
        "primary_disease": results[0]["disease"] if results else "Unknown",
        "primary_probability": results[0]["probability"] if results else 0
    })


# ── 5. AI Advice Endpoint ────────────────────────────────────────────────────
@app.route("/ai-advice", methods=["POST"])
def ai_advice():
    if not gemini_model:
        return jsonify({"error": "Gemini API key not configured"}), 500

    data = request.json
    disease = data.get("disease", "Unknown")
    symptoms = data.get("symptoms", [])
    age = data.get("age", "Unknown")
    gender = data.get("gender", "Unknown")
    history = data.get("history", "None")
    severity = data.get("severity", "Unknown")

    prompt = f"""
You are a medical information assistant. A patient has the following details:
- Age: {age}
- Gender: {gender}
- Medical history: {history}
- Reported symptoms: {', '.join(symptoms)}
- AI predicted condition: {disease} (Severity: {severity})

Provide a SHORT, structured medical guidance response in the following JSON format ONLY (no markdown, no extra text):
{{
  "do_list": ["3-4 things the patient SHOULD do"],
  "dont_list": ["3-4 things the patient should NOT do"],
  "see_doctor_when": ["2-3 specific signs that require immediate doctor visit"],
  "home_remedies": ["2-3 simple home care tips"],
  "urgency": "immediate / within 24 hours / within a week / routine checkup"
}}

Keep each point under 12 words. Be practical and specific to the condition.
"""

    try:
        response = gemini_model.generate_content(prompt)
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        advice = json.loads(text.strip())
        return jsonify({"advice": advice, "disease": disease})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 6. Get All Symptoms by Category ─────────────────────────────────────────
@app.route("/symptoms", methods=["GET"])
def get_symptoms():
    result = {}
    for category in medical_data['categories']:
        result[category['name']] = {
            "id": category['id'],
            "icon": category.get('icon', ''),
            "symptoms": category['symptoms_list']
        }
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)