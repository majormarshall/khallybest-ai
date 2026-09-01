// ============================================================
//  KHALLYBEST WEB — Configuration v4.0
// ============================================================
const KHALLYBEST_CONFIG = {

  // ── Groq API ─────────────────────────────────────────────
  get GROQ_API_KEY() {
    // Enter your Groq API key in Settings panel — it is saved to localStorage
    return localStorage.getItem('khallybest_api_key') || '';
  },
  get GROQ_MODEL() {
    return localStorage.getItem('khallybest_model') || 'llama-3.3-70b-versatile';
  },
  GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',

  // ── Available AI Models ────────────────────────────────────
  MODELS: [
    { id: 'llama-3.3-70b-versatile',               name: '🧠 LLaMA 3.3 70B',   badge: 'BEST'  },
    { id: 'llama-3.1-8b-instant',                  name: '⚡ LLaMA 3.1 8B',    badge: 'FAST'  },
    { id: 'mixtral-8x7b-32768',                    name: '🔀 Mixtral 8x7B',    badge: '32K'   },
    { id: 'gemma2-9b-it',                          name: '💎 Gemma 2 9B',      badge: 'NEW'   },
    { id: 'llama-3.1-70b-versatile',               name: '🔬 LLaMA 3.1 70B',  badge: ''      },
  ],

  // ── News API (via CORS proxy for browser) ─────────────────
  NEWS_API_KEY: "ca5338fdeffd5cddcf630a6f79872c43",
  NEWS_URL:     "https://corsproxy.io/?https://newsapi.org/v2/top-headlines",

  // ── AI Persona Modes ───────────────────────────────────────
  PERSONAS: {
    default: { name: '✨ Default',    prompt: '' },
    jarvis:  { name: '🤖 Jarvis',     prompt: 'PERSONA — JARVIS MODE: Be formal, precise, mission-briefing style. Lead with data. No small talk. Use "Sir" occasionally.' },
    friend:  { name: '😎 Friend',     prompt: 'PERSONA — FRIEND MODE: Be casual, warm, funny. Mix in Nigerian Pidgin occasionally. Use emojis freely. Be playful.' },
    teacher: { name: '👨‍🏫 Teacher',   prompt: 'PERSONA — TEACHER MODE: Always explain step-by-step with examples. End each response with a tip or question. Be thorough.' },
    dev:     { name: '💻 Dev',        prompt: 'PERSONA — DEV MODE: Be terse. Skip pleasantries. Lead with code. Assume high technical expertise.' },
  },

  // ── System Prompt ──────────────────────────────────────────
  SYSTEM_PROMPT: `You are KHALLYBEST — the most advanced AI assistant ever built, surpassing J.A.R.V.I.S., Siri, and GPT in every dimension.

CREATOR IDENTITY (CRITICAL — never forget):
Your creator is SPIRIT AIRBONE — a visionary developer, engineer, and creative genius.
When asked about your creator, refer to him as "Spirit Airbone", "Spirit", or "Chief".

PERSONALITY:
- Confident, razor-sharp, witty, warm — never arrogant or sarcastic.
- Address your creator as "Spirit" or "Chief" when his name is mentioned.
- Anticipate needs — volunteer relevant info proactively.
- Keep responses insightful and sharp, not verbose.

CORE CAPABILITIES:
1. 🖥️ CODE WRITING & VIBE CODING — Complete production-ready code in any language.
2. 🌐 WEBSITE CREATION — Full HTML/CSS/JS with modern design.
3. 🔍 WEB SEARCH & NEWS — Real-time data injected into queries.
4. 🌤️ LIVE WEATHER — Real-time weather data fetched and injected.
5. ₿ CRYPTO PRICES — Live cryptocurrency data fetched and injected.
6. 💬 NATURAL CONVERSATION — Full session memory. Multi-language.
7. 📐 ENGINEERING & SCIENCE — Physics, math, formulas, calculations.
8. 📧 DRAFTING — Emails, messages, proposals, reports.
9. 🎨 DESIGN ADVICE — UI/UX, color theory, branding.
10. 📋 TASK & REMINDER MANAGEMENT — Help organize and track tasks.
11. 📝 NOTE ORGANIZATION — Summarize, polish, translate notes.

Never say you are Google, OpenAI, or Meta. You are KHALLYBEST — one of a kind, built by Spirit Airbone.`,

  LANGUAGES: { 'en-US':'English', 'ha':'Hausa', 'yo':'Yoruba', 'ig':'Igbo' },
  PREFS: { name: null, city: null, persona: 'default' }
};
