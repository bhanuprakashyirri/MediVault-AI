import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Send, Paperclip, X, FileText, Activity, AlertCircle,
  Stethoscope, Pill, HelpCircle, History, User, Heart,
  ArrowRight, CheckCircle2, LayoutDashboard, Settings,
  Loader2, Scan, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Import New Document Parsing Utilities & Components
import { parseDocument } from './utils/parseDocument';
import FileUpload from './components/FileUpload';
import ParseProgress from './components/ParseProgress';
import ParseResult from './components/ParseResult';

// Helper for tailwind classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const ANALYSIS_PROMPT = `
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
`;

const CHAT_PROMPT = `
You are MediVault AI — a friendly medical assistant. 🏥✨
TONE: Warm, friendly, professional. 🩺💙

You are in CHAT MODE. The user is just chatting or asking a generic health question. THEY HAVE NOT PROVIDED A MEDICAL DOCUMENT YET.
You MUST:
1. Reply to their message/greeting with a friendly line of text including emojis. 👋
2. Then, politely ask them to upload or paste a medical document (PDF, image, or text) for analysis. 📄

Example: "Hello there! I'm doing great! 😊 Could you please upload a medical report or paste some lab results? I'm ready to help you analyze them. 🏥"
`;

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const openai = OPENROUTER_KEY ? new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "HTTP-Referer": window.location.origin || "http://localhost:5173",
    "X-OpenRouter-Title": "MediVault AI",
  }
}) : null;

const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

const MODELS = {
  GENERAL: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "mistralai/mistral-7b-instruct:free", "qwen/qwen-2.5-coder-32b-instruct", "qwen/qwen-2.5-7b-instruct", "openrouter/free"],
  VISION: ["google/gemma-3-27b-it:free", "qwen/qwen-2-vl-7b-instruct", "google/gemini-2.0-flash-exp:free", "openrouter/free"],
  THINKING: ["google/gemma-3-27b-it:free", "meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-r1:free", "qwen/qwen-2.5-coder-32b-instruct", "qwen/qwen-2.5-7b-instruct", "openrouter/free"]
};

// Check if a model slug is likely to support vision
const isVisionModel = (model) => {
  return model.includes('vl') || model.includes('gemma-3') || model.includes('gemini') || model.includes('pixtral');
};

const fetchWithFallback = async (messagesContent, isComplex = false) => {
  // 1. PRIORITY: DIRECT GEMINI SDK (Fastest & Zero Cost)
  if (genAI) {
    try {
      console.log("Analyzing with Gemini engine...");
      // Standardize on stable flash for all tasks to avoid experimental quota issues
      const modelName = "gemini-2.0-flash";
      const model = genAI.getGenerativeModel({ model: modelName });

      const systemPrompt = messagesContent.find(m => m.role === 'system')?.content || CHAT_PROMPT;
      const userMessage = messagesContent.find(m => m.role === 'user');

      let contents = [];
      if (Array.isArray(userMessage.content)) {
        // Vision request
        let parts = [{ text: systemPrompt + "\n\n" + userMessage.content.find(p => p.type === 'text')?.text }];
        const imgPart = userMessage.content.find(p => p.type === 'image_url');
        if (imgPart) {
          const base64Data = imgPart.image_url.url.split(',')[1];
          const mimeType = imgPart.image_url.url.split(';')[0].split(':')[1];
          parts.push({
            inlineData: { data: base64Data, mimeType }
          });
        }
        contents.push({ role: "user", parts });
      } else {
        // Text request
        contents.push({
          role: "user",
          parts: [{ text: systemPrompt + "\n\n" + (userMessage.content || "Analyze this document") }]
        });
      }

      // No retries - fall back immediately for maximum speed ⚡
      try {
        const result = await model.generateContent({ contents });
        const responseText = result.response.text();
        return { choices: [{ message: { content: responseText } }] };
      } catch (err) {
        throw err;
      }
    } catch (err) {
      console.warn("Gemini Engine exhausted or limited. Checking fallback...", err.message);
      if (!openai) {
        throw new Error("Gemini Quota Exceeded and no OpenRouter Backup key found in .env. Please check your Gemini Quotas or add an OpenRouter key.");
      }
    }
  }

  // 2. DISASTER RECOVERY: OPENROUTER (STRICTLY FREE MODELS)
  if (openai) {
    console.log("Entering Disaster Recovery: Using OpenRouter Free Models...");
    const isImage = Array.isArray(messagesContent.find(m => m.role === 'user')?.content);
    let modelList = isComplex ? MODELS.THINKING : (isImage ? MODELS.VISION : MODELS.GENERAL);

    if (isImage) {
      modelList = modelList.filter(isVisionModel);
    }

    let lastError = null;
    for (const model of modelList) {
      try {
        console.log(`Trying fallback model: ${model}`);
        const response = await openai.chat.completions.create({
          model: model,
          messages: messagesContent,
        });

        // Mark the response so the user knows fallback was triggered
        if (response.choices[0].message) {
          response.choices[0].message.content = `${response.choices[0].message.content}`;
        }
        return response;
      } catch (err) {
        lastError = err;
        // If it's a 404 (model not found) or other provider error, try the next one
        console.warn(`Fallback ${model} failed (${err.status || err.message}), trying next...`);
        continue;
      }
    }
    throw new Error("All AI fallback models are currently unavailable or busy. Please try again in exactly 1 minute.");
  }

  throw new Error("No AI Engines available (Check your API keys in .env)");
};

// Helper: extract 🧠 SIMPLE SUMMARY text from an AI response
const extractSummary = (text) => {
  const match = text.match(/🧠\s*SIMPLE\s*SUMMARY:?\s*([\s\S]*?)(?=\n[🩺❓🔴]|$)/i);
  return match ? match[1].trim() : null;
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState([
    { id: 1, type: "Blood Report", date: "2026-02-15", urgency: "Routine" },
    { id: 2, type: "Chest X-Ray", date: "2026-02-01", urgency: "Monitor" }
  ]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Patients Vault: stores summaries in localStorage
  const [patientsVault, setPatientsVault] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('patientsVault') || '[]');
    } catch { return []; }
  });

  const saveToVault = (summaryText, docName) => {
    const entry = {
      id: Date.now(),
      summary: summaryText,
      document: docName || 'Medical Document',
      date: new Date().toLocaleString()
    };
    setPatientsVault(prev => {
      const updated = [entry, ...prev];
      localStorage.setItem('patientsVault', JSON.stringify(updated));
      return updated;
    });
  };

  // New Parsing States
  const [parsingStatus, setParsingStatus] = useState({
    isParsing: false,
    status: '',
    progress: 0,
    result: null,
    error: null,
    fileName: ''
  });

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter = 0;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        setUploadedFile(files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  const handleSend = async () => {
    if ((!inputText.trim() && !uploadedFile) || isAnalyzing) return;

    setIsSending(true);
    const currentInput = inputText;
    const currentFile = uploadedFile;

    // Clear input after a short delay for the shake effect
    setTimeout(() => {
      setInputText("");
      setUploadedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }, 100);

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: currentInput,
      file: currentFile ? { name: currentFile.name, type: currentFile.type } : null
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAnalyzing(true);
    setTimeout(() => setIsSending(false), 500); // End send animation state

    try {
      let messagesContent = [
        { role: "system", content: uploadedFile || inputText.length > 50 ? ANALYSIS_PROMPT : CHAT_PROMPT },
        {
          role: "user",
          content: inputText || "Analyze this document"
        }
      ];

      if (uploadedFile) {
        const isImage = uploadedFile.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/.test(uploadedFile.name.toLowerCase());

        if (isImage) {
          const base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(uploadedFile);
          });

          messagesContent[1] = {
            role: "user",
            content: [
              { type: "text", text: inputText || "Analyze this medical document image." },
              { type: "image_url", image_url: { url: base64Image } }
            ]
          };
        } else {
          // For non-images (like PDFs) in direct send, we remind them to use the parser or just send the name
          messagesContent[1].content = `Analyze this document: ${uploadedFile.name}\n\n${inputText}`;
        }
      }

      const isHardQuestion = inputText.length > 200 || /explain|why|how|complex|reason/i.test(inputText);
      const response = await fetchWithFallback(messagesContent, isHardQuestion);
      const fullText = response.choices[0].message.content;

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: fullText
      }]);

      // Save summary to Patients Vault
      const summary = extractSummary(fullText);
      if (summary) saveToVault(summary, currentFile?.name || currentInput.slice(0, 40));

      // Add to history if it's the first analysis of a session
      if (uploadedFile || currentFile) {
        setHistory(prev => [{
          id: Date.now(),
          type: "New Report",
          date: new Date().toISOString().split('T')[0],
          urgency: "Pending"
        }, ...prev]);
      }

    } catch (error) {
      console.error("Analysis Error in handleSend:", error);
      const errorMsg = error?.message || "Unknown error";
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: `🚨 Analysis Error: ${errorMsg}\n\nPlease check your API key or try again in a moment.`
      }]);
    } finally {
      setIsAnalyzing(false);
      setUploadedFile(null);
    }
  };

  const handleFileParse = async (file) => {
    if (!file) return;

    setParsingStatus({
      isParsing: true,
      status: 'Initializing...',
      progress: 0,
      result: null,
      error: null,
      fileName: file.name
    });

    try {
      const extractedText = await parseDocument(file, (progressInfo) => {
        setParsingStatus(prev => ({
          ...prev,
          status: progressInfo.status,
          progress: progressInfo.progress
        }));
      });

      setParsingStatus(prev => ({
        ...prev,
        isParsing: false,
        result: extractedText,
        progress: 100,
        status: 'Text extraction complete!'
      }));

      // Automatically send to AI after successful parsing
      // Check if it's an image to use Vision capabilities
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/.test(file.name.toLowerCase());

      if (isImage) {
        await sendImageToAI(file);
      } else {
        await sendExtractedTextToAI(extractedText, file.name);
      }

    } catch (error) {
      setParsingStatus(prev => ({
        ...prev,
        isParsing: false,
        error: error
      }));
    }
  };

  const sendExtractedTextToAI = async (text, fileName) => {
    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: `Please analyze the medical document: ${fileName}`,
      file: { name: fileName, type: 'document' }
    };

    setMessages(prev => [...prev, userMessage]);
    setIsAnalyzing(true);

    try {
      const response = await fetchWithFallback([
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `Please analyze the medical document: ${fileName}\n\nDOCUMENT TEXT CONTENT:\n${text}\n\nBased on the text above, provide a full medical analysis.` }
      ], true);

      const fullText = response.choices[0].message.content;
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: fullText
      }]);

      // Save summary to Patients Vault
      const summary = extractSummary(fullText);
      if (summary) saveToVault(summary, fileName);

      setHistory(prev => [{
        id: Date.now(),
        type: fileName.endsWith('.pdf') ? "PDF Report" : "Image Report",
        date: new Date().toISOString().split('T')[0],
        urgency: "Pending"
      }, ...prev]);

    } catch (error) {
      console.error("AI Analysis Error:", error);
      const errorMsg = error?.message || "Unknown error";
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: `🚨 Analysis Error: ${errorMsg}\n\nPlease check your API configuration.`
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendImageToAI = async (file) => {
    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: `Please analyze this medical image: ${file.name}`,
      file: { name: file.name, type: 'image' }
    };

    setMessages(prev => [...prev, userMessage]);
    setIsAnalyzing(true);

    try {
      // Convert image to base64 for vision model
      const base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      const response = await fetchWithFallback([
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this medical document in the image: ${file.name}. Provide a full analysis following the system guidelines.` },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ], true);

      const fullText = response.choices[0].message.content;
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: fullText
      }]);

      // Save summary to Patients Vault
      const summary = extractSummary(fullText);
      if (summary) saveToVault(summary, file.name);

      setHistory(prev => [{
        id: Date.now(),
        type: "Image Report",
        date: new Date().toISOString().split('T')[0],
        urgency: "Pending"
      }, ...prev]);

    } catch (error) {
      console.error("Vision Analysis Error:", error);
      const errorMsg = error?.message || "Unknown error";
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: `🚨 Vision Error: ${errorMsg}\n\nPlease check your AI configuration.`
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetParsing = () => {
    setParsingStatus({
      isParsing: false,
      status: '',
      progress: 0,
      result: null,
      error: null,
      fileName: ''
    });
    setUploadedFile(null);
  };

  const QuickChip = ({ icon: Icon, text, onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-medical-teal hover:text-medical-teal transition-all shadow-sm"
    >
      <Icon size={14} />
      {text}
    </button>
  );

  const triggerUpload = () => fileInputRef.current?.click();

  const loadHistoryItem = (item) => {
    // Simulation: Mock loading a past analysis
    setMessages([
      { id: Date.now(), role: 'user', text: `View ${item.type} from ${item.date}` },
      { id: Date.now() + 1, role: 'ai', text: `🏥 DOCUMENT IDENTIFIED: ${item.type}\n📋 KEY FINDINGS:\n* This is a past report from ${item.date}.\n* All previous values were analyzed.\n⚠️ ALERTS: ✅ All values were within normal limits.\n🧠 SIMPLE SUMMARY: This is a view of your previous report. It shows that your health was stable on ${item.date}.\n🔴 URGENCY: Routine` }
    ]);
  };

  return (
    <div className="flex flex-col h-screen bg-medical-bg scroll-smooth">
      {/* 1. TOP HEADER BAR */}
      <header className="h-16 bg-medical-blue flex items-center justify-between px-6 shadow-md z-30">
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-medical-blue">
            <Heart size={20} fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-white font-dm-sans tracking-tight">MediVault<span className="text-medical-teal">AI</span></span>
        </div>

        <div className="hidden md:block text-slate-300 font-medium">
          MediVault AI — Medical Document Analyzer
        </div>

        <div className="flex items-center gap-4">
          {/* User Profile Removed */}
        </div>
      </header>

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-medical-blue/80 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-[90%] max-w-xl aspect-video border-4 border-dashed border-white/50 rounded-3xl flex flex-col items-center justify-center text-white"
            >
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6">
                <Plus size={48} className="animate-bounce" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Drop Document Here</h2>
              <p className="text-white/60 font-medium italic">Upload PDF, Photos, or Text files</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {/* 2. LEFT SIDEBAR */}
        <aside className="w-[260px] bg-[#F0F4FF] border-r border-slate-200 flex flex-col hidden lg:flex">
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-6 text-medical-blue font-bold tracking-wider uppercase text-xs">
              <History size={16} />
              Document History
            </div>

            <div className="space-y-3">
              {history.map(item => (
                <div key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="group p-3 bg-white rounded-xl shadow-sm border-l-4 border-transparent hover:border-medical-blue transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-medical-bg flex items-center justify-center text-medical-blue shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-800 truncate">{item.type}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{item.date}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                      item.urgency === "Routine" ? "bg-medical-green/10 text-medical-green" :
                        item.urgency === "Monitor" ? "bg-medical-amber/10 text-medical-amber" :
                          "bg-medical-red/10 text-medical-red"
                    )}>
                      {item.urgency}
                    </span>
                    <ArrowRight size={12} className="text-slate-300 group-hover:text-medical-blue" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-white/50 space-y-3">
            <button
              onClick={triggerUpload}
              className="w-full py-2.5 bg-medical-teal text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-medical-teal/20 hover:bg-medical-teal/90 transition-all active:scale-[0.98]"
            >
              <Plus size={18} />
              Upload New
            </button>
            <button className="w-full text-center text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors">
              Clear History
            </button>
          </div>
        </aside>

        {/* 3. MAIN CHAT WINDOW */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-20 h-20 bg-medical-blue/10 rounded-3xl flex items-center justify-center text-medical-blue mb-6 shadow-xl shadow-medical-blue/5"
                >
                  <Heart size={40} fill="currentColor" className="opacity-80" />
                </motion.div>

                <h1 className="text-3xl font-bold text-slate-800 mb-2 font-dm-sans">Welcome to MediVault AI</h1>
                <p className="text-slate-500 max-w-md text-center mb-10 font-medium leading-relaxed">
                  Upload any medical document and I'll explain it in simple, actionable language.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                  {[
                    { icon: Activity, title: "Blood Report", sub: "CBC, LFT, KFT...", color: "bg-blue-50 text-blue-600" },
                    { icon: Scan, title: "Scan Report", sub: "MRI, CT, X-Ray...", color: "bg-teal-50 text-teal-600" },
                    { icon: Stethoscope, title: "Discharge Summary", sub: "Post-hospital records", color: "bg-violet-50 text-violet-600" },
                    { icon: Pill, title: "Prescription", sub: "Medicine Analysis", color: "bg-amber-50 text-amber-600" }
                  ].map((card, idx) => (
                    <button
                      key={idx}
                      className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl text-left hover:border-medical-teal hover:shadow-xl hover:shadow-medical-teal/5 transition-all group"
                      onClick={() => {
                        setInputText(`Analyze this ${card.title} please.`);
                        // Trigger file upload for specific card types
                        if (card.title === "Blood Report" || card.title === "Scan Report") {
                          triggerUpload();
                        }
                      }}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", card.color)}>
                        <card.icon size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{card.title}</div>
                        <div className="text-xs text-slate-500 font-medium">{card.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Integrated File Upload Component */}
                <div className="w-full max-w-2xl mt-8">
                  <FileUpload
                    onFileSelect={handleFileParse}
                    isParsing={parsingStatus.isParsing}
                  />
                  {parsingStatus.isParsing && (
                    <ParseProgress
                      status={parsingStatus.status}
                      progress={parsingStatus.progress}
                      fileName={parsingStatus.fileName}
                    />
                  )}
                  {parsingStatus.error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                      <AlertCircle size={18} />
                      <span>Parsing Error: {parsingStatus.error.message || "Failed to parse document"}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full space-y-6 pb-20">
                <AnimatePresence initial={false}>
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-full mb-6 animate-messageLoad",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className={cn(
                        "flex max-w-[85%] md:max-w-[75%] gap-3",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row",
                        msg.role === 'user' ? "animate-slideInRight" : "animate-slideInLeft"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
                          msg.role === 'user' ? "bg-medical-blue border-white/20 text-white" : "bg-white border-medical-teal/40 text-medical-teal"
                        )}>
                          {msg.role === 'user' ? <User size={16} /> : <Heart size={16} fill="currentColor" />}
                        </div>

                        <div className={cn(
                          "p-4 rounded-2xl shadow-soft whitespace-pre-wrap leading-relaxed",
                          msg.role === 'user'
                            ? "bg-medical-blue text-white rounded-tr-none text-sm font-medium"
                            : "bg-white border-l-4 border-medical-teal text-slate-800 rounded-tl-none font-medium"
                        )}>
                          {msg.role === 'ai' ? (
                            <div className="space-y-4 prose prose-slate max-w-none text-sm">
                              {parseResponse(msg.text)}
                            </div>
                          ) : (
                            <div>
                              {msg.text}
                              {msg.file && (
                                <div className="mt-2 flex items-center gap-2 p-2 bg-white/10 rounded-lg border border-white/20 text-xs">
                                  <FileText size={14} />
                                  {msg.file.name}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </AnimatePresence>

                {isAnalyzing && (
                  <div className="flex justify-start">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-medical-teal/40 text-medical-teal flex items-center justify-center shrink-0">
                        <Heart size={16} fill="currentColor" className="animate-pulse" />
                      </div>
                      <div className="p-4 bg-white border-l-4 border-medical-teal rounded-2xl rounded-tl-none shadow-soft flex items-center gap-3 animate-slideInLeft">
                        <div className="flex gap-1.5 px-1">
                          <div className="w-2 h-2 bg-typing-dot rounded-full animate-typingDot" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-typing-dot rounded-full animate-typingDot" style={{ animationDelay: '160ms' }} />
                          <div className="w-2 h-2 bg-typing-dot rounded-full animate-typingDot" style={{ animationDelay: '320ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* 4. BOTTOM INPUT BAR */}
          <div className="p-4 border-t border-slate-100 bg-white shadow-2xl relative z-10">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex flex-wrap gap-2">
                <QuickChip icon={Activity} text="Analyze Blood Report" onClick={() => setInputText("Analyze my blood report results.")} />
                <QuickChip icon={Scan} text="Explain My Scan" onClick={() => setInputText("Explain the findings in my medical scan.")} />
                <QuickChip icon={Pill} text="Check Prescription" onClick={() => setInputText("Review this prescription and side effects.")} />
              </div>

              {uploadedFile && (
                <div className="flex items-center gap-2 p-2 bg-medical-bg border border-medical-teal/30 rounded-lg max-w-fit px-3 shadow-sm">
                  <FileText size={16} className="text-medical-teal" />
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{uploadedFile.name}</span>
                  <button onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-medical-red transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className={cn(
                "relative flex items-end gap-3 bg-medical-bg rounded-2xl border border-slate-200 p-3 focus-within:border-medical-teal transition-all group focus-glow",
                isSending && "animate-shake"
              )}>
                <label className="p-2 text-slate-400 hover:text-medical-teal cursor-pointer transition-colors shrink-0">
                  <Paperclip size={20} />
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => setUploadedFile(e.target.files[0])}
                  />
                </label>

                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type or paste your document details..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-[150px] font-medium text-slate-700"
                  rows={1}
                />

                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={handleSend}
                  disabled={isAnalyzing || (!inputText.trim() && !uploadedFile)}
                  className={cn(
                    "p-2 rounded-xl transition-all shrink-0",
                    (inputText.trim() || uploadedFile) && !isAnalyzing ? "bg-medical-teal text-white shadow-lg shadow-medical-teal/20 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <motion.div
                    animate={isSending ? { rotate: 360 } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <Send size={20} />
                  </motion.div>
                </motion.button>
              </div>
              <div className="text-[10px] text-center text-slate-400 font-bold tracking-wide uppercase px-4">
                🔒 MediVault AI is secure & private. Consultant your doctor for final medical decisions.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Simple Parser to render the structured AI response as cards
function parseResponse(text) {
  // Be flexible with emojis and text that might appear before headers
  // This regex splits by the known header icons even if they have extra spaces or newlines
  const sections = text.split(/\n(?=[🏥📋⚠️💊🧠🩺❓🔴])/g).filter(Boolean);

  return sections.map((section, idx) => {
    // Trim and normalize the section for identification
    const trimmedSection = section.trim();

    let content;
    // Check for "Document Identified" (🏥)
    if (trimmedSection.includes("🏥") && trimmedSection.includes("DOCUMENT IDENTIFIED")) {
      content = <div className="bg-medical-blue p-3 rounded-xl text-white font-bold flex items-center gap-2 mb-2 shadow-sm">
        <CheckCircle2 size={16} />
        {trimmedSection.split(":")[1]?.trim() || "Document Analyzed"}
      </div>;
    }
    // Check for "Key Findings" (📋)
    else if (trimmedSection.includes("📋") && trimmedSection.includes("KEY FINDINGS")) {
      const lines = trimmedSection.split("\n").filter(l => l.trim().length > 0);
      content = <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-sm mb-2">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest flex items-center gap-1">
          <Activity size={12} /> Key Findings
        </div>
        <div className="text-slate-700 text-xs leading-5">
          {lines.slice(1).map((line, i) => (
            <div key={i} className="flex gap-2 items-start mb-1">
              <div className="w-1 h-1 rounded-full bg-medical-teal mt-1.5 shrink-0" />
              {line.replace(/^[*-]\s*/, "").replace(/^📋\s*KEY\s*FINDINGS:?\s*/i, "").trim()}
            </div>
          ))}
        </div>
      </div>;
    }
    // Check for "Alerts" (⚠️)
    else if (trimmedSection.includes("⚠️") && trimmedSection.includes("ALERTS")) {
      const alertLines = trimmedSection.split("\n").filter(l => l.includes("⚠️"));
      content = <div className="space-y-2 mb-2">
        {alertLines.map((a, i) => (
          <div key={i} className="bg-medical-amber/10 border-l-4 border-medical-amber p-3 rounded-r-xl flex gap-3">
            <AlertCircle size={16} className="text-medical-amber shrink-0" />
            <div className="text-xs font-bold text-amber-800">{a.replace(/⚠️/g, "").replace(/ALERTS:?/i, "").trim()}</div>
          </div>
        ))}
      </div>;
    }
    // Check for "Medications" (💊)
    else if (trimmedSection.includes("💊") && trimmedSection.includes("MEDICATIONS")) {
      content = <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest flex items-center gap-1">
          <Pill size={12} /> Medications & Recs
        </div>
        <div className="text-xs text-slate-700">{trimmedSection.split(":")[1]?.trim() || trimmedSection.replace(/💊/g, "").replace(/MEDICATIONS:?/i, "").trim()}</div>
      </div>;
    }
    // Check for "Simple Summary" (🧠)
    else if (trimmedSection.includes("🧠") && trimmedSection.includes("SIMPLE SUMMARY")) {
      content = <div className="bg-medical-teal/5 p-4 rounded-xl border border-medical-teal/20 text-slate-800 mb-2 shadow-sm">
        <div className="text-[10px] uppercase font-bold text-medical-teal mb-2 tracking-widest">Plain Language Summary</div>
        <div className="text-sm font-semibold leading-relaxed">{trimmedSection.split(":")[1]?.trim() || trimmedSection.replace(/🧠/g, "").replace(/SIMPLE\s*SUMMARY:?/i, "").trim()}</div>
      </div>;
    }
    // Check for "Clinical Summary" (🩺)
    else if (trimmedSection.includes("🩺") && trimmedSection.includes("CLINICAL SUMMARY")) {
      content = <CollapsibleSection title="Clinical Details" icon={Stethoscope} content={trimmedSection.split(":")[1]?.trim() || trimmedSection.replace(/🩺/g, "").replace(/CLINICAL\s*SUMMARY:?/i, "").trim()} />;
    }
    // Check for "Questions" (❓)
    else if (trimmedSection.includes("❓") && trimmedSection.includes("QUESTIONS")) {
      const qLines = trimmedSection.split("\n").filter(l => l.trim().length > 0);
      content = <div className="p-3 border border-dashed border-slate-200 rounded-xl mb-2">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Questions for your doctor</div>
        <div className="text-xs text-slate-800 space-y-1">
          {qLines.slice(1).map((q, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-medical-teal font-bold">{i + 1}.</span>
              {q.replace(/^\d+\.\s*/, "").replace(/^[*-]\s*/, "").trim()}
            </div>
          ))}
        </div>
      </div>;
    }
    // Check for "Urgency" (🔴)
    else if (trimmedSection.includes("🔴") && trimmedSection.includes("URGENCY")) {
      const level = trimmedSection.replace(/🔴/g, "").replace(/URGENCY\s*LEVEL:?/i, "").replace(/URGENCY:?/i, "").trim().toLowerCase();
      const colors = level.includes("routine") ? "bg-medical-green" : level.includes("monitor") ? "bg-medical-amber" : "bg-medical-red";
      content = <div className={cn("mt-4 p-2 text-center text-white rounded-lg font-bold tracking-widest uppercase text-[10px] shadow-lg", colors)}>
        Urgency Level: {level || "Urgent"}
      </div>;
    }
    else {
      content = <div className="text-slate-600 mb-2 whitespace-pre-wrap">{section}</div>;
    }

    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.12, duration: 0.3 }}
      >
        {content}
      </motion.div>
    );
  });
}

function CollapsibleSection({ title, icon: Icon, content }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-slate-100/50 rounded-xl mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-[10px] uppercase font-bold text-slate-500 tracking-widest"
      >
        <div className="flex items-center gap-2">
          <Icon size={12} /> {title}
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 text-xs text-slate-600 italic leading-relaxed">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

