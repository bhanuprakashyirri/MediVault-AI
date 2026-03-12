import os
import base64
import streamlit as st
import requests
import json
from dotenv import load_dotenv
from PIL import Image
import google.generativeai as genai
from io import BytesIO

# Load environment variables
load_dotenv()

# API Configuration
# Supporting both VITE_ and standard names for consistency
openrouter_key = os.getenv("VITE_OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API_KEY")
gemini_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")

if gemini_key:
    genai.configure(api_key=gemini_key)

# Strictly using :free models to ensure NO CHARGES
MODELS = {
    "GENERAL": ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "arcee-ai/trinity-large-preview:free", "qwen/qwen-2.5-coder-32b-instruct", "qwen/qwen-2.5-7b-instruct", "openrouter/free"],
    "VISION": ["qwen/qwen3-vl-30b-a3b-thinking:free", "google/gemma-3-27b-it:free", "qwen/qwen3-vl-235b-a22b-thinking:free", "openrouter/free"],
    "THINKING": ["qwen/qwen3-vl-235b-a22b-thinking:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "qwen/qwen-2.5-coder-32b-instruct", "qwen/qwen-2.5-7b-instruct", "openrouter/free"],
    "FALLBACK": "openrouter/free"
}

# MediVault AI Analysis Prompt
ANALYSIS_PROMPT = """
You are MediVault AI — an intelligent medical document analysis assistant. 🏥✨
AUDIENCE: Patients, Doctors. TONE: Warm, friendly, professional. 🩺💙

You are in ANALYSIS MODE. The user has provided medical text, an image, or a document file.
You MUST provide a full analysis using the STRICT OUTPUT FORMAT below.
DO NOT add ANY emojis or text BEFORE the first header (🏥 DOCUMENT IDENTIFIED:).
ONLY use emojis INSIDE the sections. NEVER ask the user to upload a document.

STRICT OUTPUT FORMAT (MUST START IMMEDIATELY):
🏥 DOCUMENT IDENTIFIED: [Type]
📋 KEY FINDINGS: [Bullet points with relevant emojis] 📝
⚠️ ALERTS: [Parameter] — [Value] vs [Range] — [Meaning] 🚨
💊 MEDICATIONS: [Names, Dose, Freq] 💊
🧠 SIMPLE SUMMARY: [3-4 sentences, no jargon, friendly tone] 💡
🩺 CLINICAL SUMMARY: [Technical details if any] 🔬
❓ QUESTIONS: [2-3 for doctor] 🤔
🔴 URGENCY: [Routine / Monitor / Urgent / Critical] ⚡

RULES:
- Never diagnose.
- Always flag abnormal values with ⚠️.
- Be empathetic. 🤝
- High priority ⚠️⚠️ for lesions, masses, or fractures.
"""

# Streamlit Page Configuration
st.set_page_config(page_title="MediVault AI Analyst", page_icon="🏥", layout="wide")

# Custom CSS for Professional Branding
st.markdown("""
    <style>
    .main { background-color: #f5f7f9; }
    .stButton>button {
        background-color: #004b87;
        color: white;
        border-radius: 8px;
        padding: 10px 24px;
        border: none;
    }
    .report-container {
        padding: 20px;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    h1, h2, h3 { color: #004b87; }
    </style>
    """, unsafe_allow_html=True)

# Application Header
st.title("🏥 MediVault AI Analyst")
st.subheader("Zero-Cost Medical Document Summarization")
st.info("Powered by Gemini Free Tier and OpenRouter Free Models. Zero credits required.")

# Layout
col1, col2 = st.columns([1, 1])

with col1:
    st.markdown("### 📄 Input Document Details")
    doc_text = st.text_area("Paste report text:", height=200, placeholder="Example: Hemoglobin: 9.2 g/dL...")
    
    st.markdown("**OR**")
    uploaded_file = st.file_uploader("Upload report image", type=["png", "jpg", "jpeg"])
    
    image = None
    if uploaded_file:
        image = Image.open(uploaded_file)
        st.image(image, caption="Uploaded Document Preview", width=400)

    analyze_button = st.button("Analyze Document 🔍")

with col2:
    st.markdown("### 🏥 MediVault AI Analysis")
    if analyze_button:
        if not openrouter_key and not gemini_key:
            st.error("Please configure your API keys in the .env file.")
        elif not doc_text and not image:
            st.warning("Please provide either text or an image of the document.")
        else:
            with st.spinner(""):
                ai_response = None
                
                # 1. PRIORITY: DIRECT GEMINI API (FREE TIER - NO CHARGE)
                if gemini_key:
                    try:
                        # url = ...
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
                        
                        # Prepare parts
                        parts = [{"text": ANALYSIS_PROMPT}]
                        if doc_text:
                            parts.append({"text": f"Document Text: {doc_text}"})
                        if image:
                            buffered = BytesIO()
                            image.save(buffered, format="JPEG")
                            img_b64 = base64.b64encode(buffered.getvalue()).decode()
                            parts.append({
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": img_b64
                                }
                            })
                        
                        payload = {"contents": [{"parts": parts}]}
                        resp = requests.post(url, json=payload, timeout=60)
                        if resp.status_code == 200:
                            ai_response = resp.json()['candidates'][0]['content']['parts'][0]['text']
                        else:
                            pass
                    except Exception as e:
                        pass

                # 2. FALLBACK: OPENROUTER (STRICTLY FREE MODELS)
                if not ai_response and openrouter_key:
                    try:
                        headers = {
                            "Authorization": f"Bearer {openrouter_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:8501",
                            "X-Title": "MediVault AI Streamlit",
                        }
                        
                        messages = [{"role": "system", "content": ANALYSIS_PROMPT}]
                        content = []
                        if doc_text: content.append({"type": "text", "text": doc_text})
                        if image:
                            buffered = BytesIO()
                            image.save(buffered, format="JPEG")
                            img_str = base64.b64encode(buffered.getvalue()).decode()
                            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_str}"}})
                        messages.append({"role": "user", "content": content})

                        # Cycle through free models
                        model_list = MODELS["VISION"] if image else MODELS["THINKING"]
                        for model_name in model_list + [MODELS["FALLBACK"]]:
                            try:
                                resp = requests.post(
                                    url="https://openrouter.ai/api/v1/chat/completions",
                                    headers=headers,
                                    data=json.dumps({"model": model_name, "messages": messages}),
                                    timeout=45
                                )
                                if resp.status_code == 200:
                                    ai_response = resp.json()['choices'][0]['message']['content']
                                    break
                            except:
                                continue

                    except Exception as e:
                        st.error(f"Critical analysis failure: {str(e)}")

                if ai_response:
                    st.markdown(f'<div class="report-container">{ai_response.strip()}</div>', unsafe_allow_html=True)
                else:
                    st.error("🚨 Error: All free model providers are currently busy. Please try again in 30 seconds.")
    else:
        st.write("Results will appear here.")

st.markdown("---")
st.caption("🚨 Disclaimer: This is an AI analysis tool and does not provide medical diagnosis.")
