# 🏥 MediVault AI

> **Hospital-Grade Medical Document Intelligence.**  
> Effortlessly analyze, summarize, and understand complex medical reports using state-of-the-art AI.

![MediVault AI Banner](https://raw.githubusercontent.com/bhanuprakashyirri/MediVault-AI/main/medivault-web/public/vite.svg) *<!-- Replace with a real banner if available -->*

## ✨ Overview

MediVault AI is a professional-grade web application designed to bridge the gap between complex medical jargon and patient understanding. By leveraging advanced AI models and robust document parsing engines, it transforms static medical reports (PDFs, Images, Text) into clear, actionable, and empathetic summaries.

## 🚀 Key Features

- **📄 Intelligent Document Parsing**: Extract text from PDFs and images using high-performance OCR and document processing libraries.
- **🤖 Dual-Engine AI Analysis**:
    - **Primary**: Google Gemini 2.0 Flash for lightning-fast, cost-effective inference.
    - **Fallback**: OpenRouter integration (Llama 3, Gemma, Mistral) for 99.9% uptime.
- **🔍 Clinical & Simple Summaries**: Get the technical depth required by doctors and the clarity needed by patients.
- **⚠️ Smart Alerts**: Automatically flags abnormal lab values and critical findings.
- **📂 Patient Vault**: Local history management for tracking health progress over time.
- **🎨 Premium UI/UX**: A clean, hospital-grade interface built with Tailwind CSS 4 and smooth Framer Motion animations.

## 🛠️ Technical Stack

### Frontend
- **React 19**: Modern functional components with Hooks.
- **Vite 7**: Ultra-fast build tool and dev server.
- **Tailwind CSS 4**: Next-gen utility-first styling.
- **Framer Motion**: Fluid micro-animations and page transitions.
- **Lucide React**: Beautiful, consistent medical iconography.

### Processing Engine
- **Tesseract.js**: Client-side OCR for medical images.
- **PDF.js**: Robust PDF text extraction.
- **OpenAI SDK**: Standardized interface for LLM communication.

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/bhanuprakashyirri/MediVault-AI.git
   cd MediVault-AI
   ```

2. **Setup Environment Variables**
   Create a `.env` file in `medivault-web/` based on `.env.example`:
   ```bash
   VITE_GEMINI_API_KEY=your_key_here
   VITE_OPENROUTER_API_KEY=your_key_here
   ```

3. **Install Dependencies**
   ```bash
   cd medivault-web
   npm install
   ```

4. **Launch Development Server**
   ```bash
   npm run dev
   ```

## 🌐 Deployment

This project is optimized for deployment on **Vercel**.

1. Connect your GitHub repository to Vercel.
2. The `vercel.json` at the root will automatically handle the subdirectory build from `medivault-web/`.
3. Ensure you add `VITE_GEMINI_API_KEY` to your Vercel Environment Variables.

---

Built with ❤️ by **Bhanu Prakash Yirri**
