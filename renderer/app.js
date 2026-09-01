// ============================================================
//  KHALLYBEST DESKTOP — Renderer / UI Logic
// ============================================================

// ── State ────────────────────────────────────────────────
let isListening = false, isSpeaking = false, currentPanel = 'chat';
let recognition = null, conversationHistory = [];
let currentFilePath = '', currentPhonePath = '/sdcard/';
let selectedFileContent = '';
let micStream = null, mediaRecorder = null, audioChunks = [];

// ── DOM refs ─────────────────────────────────────────────
const orbCore    = document.getElementById('orbCore');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const waveform   = document.getElementById('waveform');
const orbHint    = document.getElementById('orbHint');
const chatLog    = document.getElementById('chatLog');
const textInput  = document.getElementById('textInput');
const micBtn     = document.getElementById('micBtn');
const langSelect = document.getElementById('langSelect');

// ── Status ────────────────────────────────────────────────
function setStatus(s) {
  const m = {
    idle:      {cls:'',          txt:'IDLE',      orb:'',          wave:false, hint:'TAP ORB TO SPEAK'},
    listening: {cls:'listening', txt:'LISTENING', orb:'listening', wave:true,  hint:'LISTENING...'},
    thinking:  {cls:'thinking',  txt:'THINKING',  orb:'thinking',  wave:false, hint:'PROCESSING...'},
    speaking:  {cls:'speaking',  txt:'SPEAKING',  orb:'speaking',  wave:true,  hint:'SPEAKING...'},
  }[s] || {cls:'',txt:'IDLE',orb:'',wave:false,hint:'TAP ORB TO SPEAK'};
  statusDot.className  = `status-dot ${m.cls}`;
  statusText.textContent = m.txt;
  orbCore.className    = `orb-core ${m.orb}`;
  waveform.className   = `waveform ${m.wave?'active':''}`;
  orbHint.textContent  = m.hint;
  micBtn.classList.toggle('active', s === 'listening');
}

// ── Add Chat Message ──────────────────────────────────────
function addMessage(text, sender='KHALLYBEST') {
  const wrap   = document.createElement('div');
  wrap.className = `msg ${sender}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = sender === 'user' ? 'U' : 'K';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ── Real-Time Data Fetchers (routed via Node IPC — no CORS) ──
// Uses window.KHALLYBEST.netFetch instead of browser fetch()
// so webSecurity can stay ON and no CORS/cookie warnings appear.

// Helper: fetch via secure Node proxy
async function nodeFetch(url, opts) {
  const res = await window.KHALLYBEST.netFetch(url, opts);
  return {
    ok:   res.ok,
    status: res.status,
    json: () => JSON.parse(res.text),
  };
}

async function fetchRealTimeContext(input) {
  const q = input.toLowerCase();
  let context = '';

  try {
    // ── Date / Time ──────────────────────────────────────────
    if (/\b(time|date|day|today|now|what.*clock|current date)\b/.test(q)) {
      const now = new Date();
      context += `\n[CURRENT DATE & TIME]\nDate: ${now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}\nTime: ${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    }

    // ── Weather ───────────────────────────────────────────────
    const wMatch = q.match(/weather(?:\s+in\s+|\s+for\s+|\s+of\s+)?([a-z ]{2,20})|([a-z ]{2,20})\s+weather|forecast\s+(?:for\s+)?([a-z ]{2,20})/);
    if (wMatch || /\b(temperature|forecast|rain|sunny|hot outside|cold outside|humidity)\b/.test(q)) {
      const city = (wMatch?.[1] || wMatch?.[2] || wMatch?.[3] || '').trim() || 'Lagos';
      addMessage(`🌤️ Fetching live weather for **${city}**...`, 'KHALLYBEST');
      const res = await nodeFetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      if (res.ok) {
        const d = res.json();
        const c = d.current_condition[0], a = d.nearest_area[0];
        context += `\n[LIVE WEATHER — ${a.areaName[0].value}, ${a.country[0].value}]\nTemp: ${c.temp_C}°C / ${c.temp_F}°F (feels like ${c.FeelsLikeC}°C)\nCondition: ${c.weatherDesc[0].value}\nHumidity: ${c.humidity}% | Wind: ${c.windspeedKmph} km/h | UV Index: ${c.uvIndex} | Visibility: ${c.visibility} km\n3-day forecast: ${d.weather.slice(0,3).map(w=>`${w.date}: max ${w.maxtempC}°C / min ${w.mintempC}°C`).join(' | ')}`;
      }
    }

    // ── Cryptocurrency ────────────────────────────────────────
    const coinMap = { bitcoin:'bitcoin',btc:'bitcoin',ethereum:'ethereum',eth:'ethereum',bnb:'binancecoin',solana:'solana',sol:'solana',dogecoin:'dogecoin',doge:'dogecoin',xrp:'ripple',ripple:'ripple',cardano:'cardano',ada:'cardano',usdt:'tether',matic:'matic-network' };
    const coinMatch = q.match(/\b(bitcoin|btc|ethereum|eth|bnb|solana|sol|dogecoin|doge|xrp|ripple|cardano|ada|usdt|matic)\b/);
    if (coinMatch) {
      const id = coinMap[coinMatch[1]];
      addMessage(`📈 Fetching live **${coinMatch[1].toUpperCase()}** price...`, 'KHALLYBEST');
      const res = await nodeFetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,ngn&include_24hr_change=true`);
      if (res.ok) {
        const d = res.json();
        if (d[id]) context += `\n[LIVE CRYPTO PRICE — ${id.toUpperCase()}]\nUSD: $${d[id].usd?.toLocaleString()} | NGN: ₦${d[id].ngn?.toLocaleString()}\n24h change: ${d[id].usd_24h_change?.toFixed(2)}%\nFetched: ${new Date().toLocaleString()}`;
      }
    }

    // ── Web Search ────────────────────────────────────────────
    if (/\b(news|latest|recent|search|find|look up|what happened|who is|who won|2024|2025|2026|currently|right now)\b/.test(q)) {
      addMessage(`🔍 Searching the web for: **${input.substring(0,60)}**...`, 'KHALLYBEST');
      const res = await nodeFetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`);
      if (res.ok) {
        const d = res.json();
        const snippets = [];
        if (d.Answer)       snippets.push(`Instant Answer: ${d.Answer}`);
        if (d.AbstractText) snippets.push(`${d.Heading}: ${d.AbstractText}`);
        (d.RelatedTopics||[]).slice(0,5).forEach(t => { if (t.Text) snippets.push(t.Text); });
        if (snippets.length) context += `\n[WEB SEARCH RESULTS for "${input.substring(0,60)}"]\n${snippets.join('\n')}`;
      }
    }

  } catch (e) { /* silent — Groq answers from training data as fallback */ }

  return context;
}

// ── Groq AI with JS-Injected Real-Time Context ────────────
async function askGroq(userInput, extra = '') {
  const lang  = KHALLYBEST_CONFIG.LANGUAGES[langSelect.value] || 'English';
  const rtCtx = await fetchRealTimeContext(userInput);

  const messages = [
    {
      role: 'system',
      content: KHALLYBEST_CONFIG.SYSTEM_PROMPT +
        `\nCurrent date/time: ${new Date().toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).` +
        (KHALLYBEST_CONFIG.PREFS.name ? `\nThe user's name is ${KHALLYBEST_CONFIG.PREFS.name}. Address them by name naturally throughout the conversation.` : '') +
        (typeof getPersonaPrompt === 'function' ? `\n${getPersonaPrompt()}` : '') +
        (rtCtx ? `\n\nREAL-TIME DATA FETCHED FOR THIS QUERY:${rtCtx}` : '') +
        `\nRespond in ${lang}. ${extra}`.trim()
    },
    ...conversationHistory.map(h => ({
      role:    h.role === 'model' ? 'assistant' : h.role,
      content: h.parts[0].text
    })),
    { role: 'user', content: userInput },
  ];

  conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await nodeFetch(KHALLYBEST_CONFIG.GROQ_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KHALLYBEST_CONFIG.GROQ_API_KEY}` },
        body:    JSON.stringify({ model: KHALLYBEST_CONFIG.GROQ_MODEL, messages, max_tokens: 2000, temperature: 0.85 }),
      });

      if (res.status === 429) { await new Promise(r => setTimeout(r, (attempt + 1) * 5000)); continue; }
      if (!res.ok) {
        const e = res.json().catch?.(() => ({})) || {};
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }

      const data  = res.json();
      const reply = data.choices?.[0]?.message?.content || "I'm having trouble responding. Please try again.";
      conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
      return reply;

    } catch (err) {
      if (attempt === 2) {
        const reply = `⚠️ AI error: ${err.message}\n\nCheck your **GROQ_API_KEY** in config.js.`;
        conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
        return reply;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}



// ── TTS ───────────────────────────────────────────────────
let _voiceSettings = { voiceName: '', pitch: 0.85, rate: 0.92, volume: 1.0 };

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/<[^>]+>/g,'').replace(/\*\*/g,'');
  const utt = new SpeechSynthesisUtterance(clean);

  // Read live values from settings panel if available
  const pitch  = parseFloat(document.getElementById('pitchRange')?.value  ?? _voiceSettings.pitch);
  const rate   = parseFloat(document.getElementById('rateRange')?.value   ?? _voiceSettings.rate);
  const volume = parseFloat(document.getElementById('volRange')?.value    ?? _voiceSettings.volume);
  const selName = document.getElementById('voiceSelect')?.value           || _voiceSettings.voiceName;

  utt.pitch  = pitch;
  utt.rate   = rate;
  utt.volume = volume;
  utt.lang   = 'en-US';

  const voices = window.speechSynthesis.getVoices();
  if (selName) {
    const picked = voices.find(v => v.name === selName);
    if (picked) utt.voice = picked;
  } else {
    // fallback: prefer a male voice
    const male = voices.find(v =>
      v.name.includes('David') || v.name.includes('Daniel') ||
      v.name.toLowerCase().includes('male') || v.name.includes('Google UK English Male')
    );
    if (male) utt.voice = male;
  }

  utt.onstart = () => { isSpeaking=true; setStatus('speaking'); };
  utt.onend   = () => { isSpeaking=false; setStatus('idle'); };
  utt.onerror = () => { isSpeaking=false; setStatus('idle'); };
  window.speechSynthesis.speak(utt);
}

// ── Voice Settings Panel ──────────────────────────────────
function populateVoices() {
  const sel  = document.getElementById('voiceSelect');
  const info = document.getElementById('voiceListInfo');
  if (!sel) return;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;

  // Save current selection
  const prev = sel.value;
  sel.innerHTML = '<option value="">🎲 Auto (best available)</option>';
  const rows = [];

  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    const flag = v.lang.startsWith('en') ? '🇬🇧' :
                 v.lang.startsWith('fr') ? '🇫🇷' :
                 v.lang.startsWith('es') ? '🇪🇸' :
                 v.lang.startsWith('de') ? '🇩🇪' :
                 v.lang.startsWith('ar') ? '🇸🇦' : '🌐';
    opt.textContent = `${flag} ${v.name} (${v.lang})`;
    if (v.name === prev || (!prev && (v.name.includes('David') || v.name.includes('Daniel')))) {
      opt.selected = true;
    }
    sel.appendChild(opt);
    rows.push(`<span style="color:var(--cyan);">${flag} ${v.name}</span> <span style="color:var(--muted);">(${v.lang}) ${v.localService ? '• offline' : '• online'}</span>`);
  });

  if (info) info.innerHTML = rows.join('<br>');
  console.log(`🎙️ ${voices.length} voices loaded.`);
}

function testVoice() {
  speak('Hello! I am KHALLYBEST, built by Spirit Airbone. How does my voice sound?');
}

function saveVoiceSettings() {
  _voiceSettings.voiceName = document.getElementById('voiceSelect')?.value || '';
  _voiceSettings.pitch     = parseFloat(document.getElementById('pitchRange')?.value  || 0.85);
  _voiceSettings.rate      = parseFloat(document.getElementById('rateRange')?.value   || 0.92);
  _voiceSettings.volume    = parseFloat(document.getElementById('volRange')?.value    || 1.0);
  // Persist via Electron prefs
  try { window.KHALLYBEST.setPrefs({ voiceSettings: _voiceSettings }); } catch(e) {}
  addMessage(`✅ Voice saved: **${_voiceSettings.voiceName || 'Auto'}** | Pitch ${_voiceSettings.pitch} | Speed ${_voiceSettings.rate} | Volume ${_voiceSettings.volume}`, 'KHALLYBEST');
  switchPanel('chat');
}

// ── Process Input ─────────────────────────────────────────
async function processInput(input) {
  if (!input.trim()) return;
  switchPanel('chat');
  addMessage(input, 'user');

  // Reminder detection — auto-create task from natural language
  if (typeof detectReminderRequest === 'function' && detectReminderRequest(input)) {
    const taskText = input.replace(/remind me (to |about )?/i,'').replace(/set (a )?reminder (to |for )?/i,'').trim();
    tasks.push({ id: Date.now(), text: taskText, dueTime: null, priority: 'normal', done: false, alerted: false, created: Date.now() });
    saveTasks();
    renderTasks();
  }

  setStatus('thinking');
  try {
    let reply = await runBuiltinCommand(input);
    if (!reply) reply = await askGroq(input);
    addMessage(reply, 'KHALLYBEST');
    speak(reply);
  } catch (err) {
    addMessage(`⚠️ Error: ${err.message}`, 'KHALLYBEST');
    setStatus('idle');
  }
}

function sendText() {
  const v = textInput.value.trim();
  if (!v) return;
  textInput.value = '';
  processInput(v);
}
textInput.addEventListener('keydown', e => { if(e.key==='Enter') sendText(); });

function quickCommand(text) { processInput(text); }

// ══════════════════════════════════════════════════════════
//  VOICE — Web Speech API (works on http://localhost)
// ══════════════════════════════════════════════════════════

// (voice variables declared at top of file)

async function requestMicPermission() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return true;
  } catch (err) {
    const msgs = {
      NotAllowedError:  '🎙️ Microphone blocked.\n👉 Windows Settings → Privacy → Microphone → Allow desktop apps.',
      NotFoundError:    '🎙️ No microphone found. Plug one in.',
      NotReadableError: '🎙️ Microphone busy — close other apps using it.',
    };
    addMessage(msgs[err.name] || `🎙️ Mic error: ${err.message}`, 'KHALLYBEST');
    return false;
  }
}

function toggleListening() {
  if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; }
  isListening ? stopListening() : startListening();
}

async function startListening() {
  // Pre-warm mic permission
  if (!micStream || micStream.getTracks().every(t => t.readyState === 'ended')) {
    const ok = await requestMicPermission();
    if (!ok) return;
  }

  // Check if online → use Web Speech API, else → Windows offline engine
  let online = true;
  try {
    const r = await window.KHALLYBEST.checkOnline();
    online = r.online;
  } catch(e) { online = false; }

  if (online) {
    // ── ONLINE: Web Speech API ──────────────────────────
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addMessage('⚠️ Speech Recognition not available.', 'KHALLYBEST'); return; }

    recognition = new SR();

    // Web Speech API language mapping
    // Hausa/Yoruba/Igbo aren't natively supported by Chrome's engine
    // so we use English recognition but Gemini responds in the chosen language
    const speechLangMap = {
      'en-US': 'en-US',
      'ha':    'en-NG',  // closest supported — Nigerian English
      'yo':    'en-NG',
      'ig':    'en-NG',
    };
    const selectedLang = langSelect.value || 'en-US';
    recognition.lang = speechLangMap[selectedLang] || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript;
      stopListening();
      processInput(t);
    };

    recognition.onerror = async (e) => {
      if (e.error === 'network') {
        // Network error → silently switch to offline
        stopListening();
        addMessage('📡 No internet detected. Switching to **offline voice mode**...', 'KHALLYBEST');
        await useOfflineVoice();
      } else {
        const msgs = {
          'not-allowed':   '🎙️ Mic blocked. Check Windows → Privacy → Microphone.',
          'no-speech':     '🎙️ No speech detected. Try again.',
          'audio-capture': '🎙️ No mic found.',
          'aborted':       null,
        };
        stopListening();
        const msg = msgs[e.error];
        if (msg) addMessage(msg, 'KHALLYBEST');
      }
    };

    recognition.onend = () => { if (isListening) stopListening(); };

    try {
      recognition.start();
      isListening = true;
      setStatus('listening');
      const langNames = { 'en-US':'🌐 English', 'ha':'🇳🇬 Hausa', 'yo':'🇳🇬 Yoruba', 'ig':'🇳🇬 Igbo' };
      orbHint.textContent = `${langNames[selectedLang] || '🌐'} — LISTENING...`;
    } catch (err) {
      addMessage(`🎙️ Voice error: ${err.message}`, 'KHALLYBEST');
      setStatus('idle');
    }

  } else {
    // ── OFFLINE: Windows System.Speech ─────────────────
    await useOfflineVoice();
  }
}

async function useOfflineVoice() {
  isListening = true;
  setStatus('listening');
  orbHint.textContent = '🔇 OFFLINE — LISTENING...';
  addMessage('🔇 **Offline voice mode** active — using Windows speech engine. Speak now...', 'KHALLYBEST');

  try {
    const result = await window.KHALLYBEST.offlineListen();
    isListening = false;
    setStatus('idle');
    if (result.text) {
      processInput(result.text);
    } else {
      addMessage('🎙️ Nothing heard. Please try again.', 'KHALLYBEST');
    }
  } catch (err) {
    isListening = false;
    setStatus('idle');
    addMessage(`🎙️ Offline voice error: ${err.message}`, 'KHALLYBEST');
  }
}

function stopListening() {
  try { recognition?.stop(); } catch(e) {}
  isListening = false;
  setStatus('idle');
}

// ── Panel Switcher ────────────────────────────────────────
function switchPanel(name) {
  currentPanel = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel${name.charAt(0).toUpperCase()+name.slice(1)}`).classList.remove('hidden');
  document.getElementById(`nav${name.charAt(0).toUpperCase()+name.slice(1)}`).classList.add('active');
}

// ═══════════════════════════════════════════════════════════
//  FILE SYSTEM PANEL
// ═══════════════════════════════════════════════════════════
async function loadDir(dirPath) {
  const result = await window.KHALLYBEST.listDir(dirPath);
  currentFilePath = result.path || dirPath;
  document.getElementById('filePathInput').value = currentFilePath;
  const list = document.getElementById('fileList');
  if (result.error) { list.innerHTML=`<p class="ph" style="color:var(--red);">❌ ${result.error}</p>`; return; }
  list.innerHTML = result.items.map(item => `
    <div class="file-item ${item.isDir?'fi-dir':''}" onclick="selectFile('${(currentFilePath+'/'+item.name).replace(/\\/g,'/')}', ${item.isDir})">
      <span class="fi-icon">${item.isDir?'📁': getFileIcon(item.ext)}</span>
      <span class="fi-name">${item.name}</span>
    </div>`).join('');
}

function getFileIcon(ext) {
  const icons = {'.js':'🟨','.ts':'🔷','.tsx':'⚛️','.jsx':'⚛️','.html':'🌐','.css':'🎨','.json':'📋','.sql':'🗄️','.py':'🐍','.md':'📝','.txt':'📄','.png':'🖼️','.jpg':'🖼️','.mp4':'🎬','.mp3':'🎵','.pdf':'📑','.zip':'🗜️','.exe':'⚙️'};
  return icons[ext] || '📄';
}

async function selectFile(filePath, isDir) {
  if (isDir) { loadDir(filePath); return; }
  document.querySelectorAll('.file-item').forEach(i=>i.classList.remove('selected'));
  event.currentTarget?.classList.add('selected');
  const result = await window.KHALLYBEST.readFile(filePath);
  const preview = document.getElementById('filePreview');
  if (result.error) { preview.innerHTML=`<p style="color:var(--red);">❌ ${result.error}</p>`; return; }
  selectedFileContent = result.content;
  const ext = filePath.split('.').pop().toLowerCase();
  const isCode = ['js','ts','tsx','jsx','html','css','json','sql','py','md','txt','sh','bash','env'].includes(ext);
  if (isCode) {
    preview.innerHTML = `<strong style="color:var(--cyan);">📄 ${filePath.split(/[\\/]/).pop()}</strong> (${(result.size/1024).toFixed(1)} KB)<br><br><pre>${escHtml(result.content.substring(0,8000))}</pre>
    <button class="tb-btn cyan" style="margin-top:10px;" onclick="sendFileToCode()">🧑‍💻 Analyze with KHALLYBEST</button>`;
  } else {
    preview.innerHTML = `<p style="color:var(--muted);">📄 Binary or unsupported file: ${filePath.split(/[\\/]/).pop()}</p>`;
  }
}

function escHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function sendFileToCode() {
  document.getElementById('codeInput').value = selectedFileContent;
  switchPanel('code');
}

async function askKHALLYBESTAboutFile() {
  if (!selectedFileContent) { addMessage("Please select a file first from the File Explorer.", 'KHALLYBEST'); return; }
  const prompt = `I have this file open:\n\`\`\`\n${selectedFileContent.substring(0,4000)}\n\`\`\`\nAnalyze it and tell me: what does it do? Any issues? What language/format is it?`;
  switchPanel('chat');
  processInput(prompt);
}

async function browsePath() {
  const paths = await window.KHALLYBEST.browseDialog('dir');
  if (paths?.[0]) loadDir(paths[0]);
}
async function goHome() { const info = await window.KHALLYBEST.getSystemInfo(); loadDir(info.homedir); }
async function goUp() {
  if (!currentFilePath) return;
  const parts = currentFilePath.replace(/\\/g,'/').split('/').filter(Boolean);
  parts.pop();
  const parent = parts.length ? (parts[0].includes(':') ? parts.join('/') : '/'+parts.join('/')) : '/';
  loadDir(parent);
}

document.getElementById('filePathInput')?.addEventListener('keydown', e => {
  if (e.key==='Enter') loadDir(e.target.value);
});

// ═══════════════════════════════════════════════════════════
//  PHONE PANEL
// ═══════════════════════════════════════════════════════════
async function checkPhone() {
  const badge = document.getElementById('phoneBadge');
  badge.textContent='● SCANNING...'; badge.className='phone-badge';
  const result = await window.KHALLYBEST.checkPhone();
  if (result.connected) {
    badge.textContent=`● CONNECTED: ${result.devices[0]}`; badge.className='phone-badge connected';
    loadPhoneDir('/sdcard/');
    addMessage(`✅ Phone connected: ${result.devices[0]}. Loading files...`, 'KHALLYBEST');
  } else {
    badge.textContent='● NOT CONNECTED'; badge.className='phone-badge disconnected';
    addMessage(result.error || 'No phone detected. Connect via USB and enable USB Debugging.', 'KHALLYBEST');
  }
}

async function loadPhoneDir(dir) {
  currentPhonePath = dir;
  const result = await window.KHALLYBEST.phoneListFiles(dir);
  const list = document.getElementById('phoneFileList');
  if (result.error) { list.innerHTML=`<p class="ph" style="color:var(--red);">❌ ${result.error}</p>`; return; }
  list.innerHTML = result.items.map(item => `
    <div class="file-item ${item.isDir?'fi-dir':''}" onclick="selectPhoneFile('${dir+item.name}', ${item.isDir})">
      <span class="fi-icon">${item.isDir?'📁':'📄'}</span>
      <span class="fi-name">${item.name}</span>
      <span style="color:var(--muted);font-size:10px;">${item.isDir?'':item.size}</span>
    </div>`).join('');
}

async function selectPhoneFile(remotePath, isDir) {
  if (isDir) { loadPhoneDir(remotePath+'/'); return; }
  const preview = document.getElementById('phonePreview');
  preview.innerHTML = `<p>📄 <strong style="color:var(--cyan);">${remotePath.split('/').pop()}</strong></p>
  <br><button class="tb-btn cyan" onclick="pullPhoneFile('${remotePath}')">⬇️ Download to PC</button>`;
}

async function pullPhoneFile(remotePath) {
  const result = await window.KHALLYBEST.phonePullFile(remotePath);
  if (result.error) { addMessage(`❌ Pull failed: ${result.error}`, 'KHALLYBEST'); }
  else { addMessage(`✅ File downloaded to: ${result.dest}`, 'KHALLYBEST'); }
}

async function takePhoneScreenshot() {
  addMessage("Taking phone screenshot...", 'KHALLYBEST');
  const result = await window.KHALLYBEST.phoneScreenshot();
  if (result.error) addMessage(`❌ Screenshot failed: ${result.error}\nMake sure your phone is connected.`, 'KHALLYBEST');
  else { addMessage(`✅ Screenshot saved to: ${result.path}`, 'KHALLYBEST'); window.KHALLYBEST.openItem(result.path); }
}

function phoneGoHome() { loadPhoneDir('/sdcard/'); }

// ═══════════════════════════════════════════════════════════
//  CODE PANEL
// ═══════════════════════════════════════════════════════════
async function analyzeCode() {
  const code   = document.getElementById('codeInput').value.trim();
  const lang   = document.getElementById('codeLang').value;
  const action = document.getElementById('codeAction').value;
  const output = document.getElementById('codeOutput');
  if (!code) { output.innerHTML='<p class="ph" style="color:var(--red);">⚠️ Paste code first.</p>'; return; }
  const actions = {
    analyze:  'Thoroughly analyze this code. Identify issues, risks, best-practices violations, and strengths.',
    edit:     'Improve and refactor this code. Return the full improved version with explanations of each change.',
    debug:    'Debug this code. Find all bugs, errors, and edge cases. Provide fixed code with explanations.',
    explain:  'Explain this code clearly section by section in simple terms.',
    optimize: 'Optimize this code for performance and readability. Return optimized version with notes.',
    convert:  'Convert this code to a more modern or efficient equivalent. Explain the conversion.',
  };
  const langHint = lang!=='auto' ? `The code is ${lang}.` : '';
  const prompt = `${actions[action]} ${langHint}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
  output.innerHTML = '<div style="display:flex;align-items:center;gap:10px;color:var(--muted);"><div class="spinner"></div> KHALLYBEST is analyzing...</div>';
  setStatus('thinking');
  document.getElementById('runBtn').disabled = true;
  try {
    const reply = await askGroq(prompt, actions[action]);
    output.innerHTML = reply
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre>$2</pre>')
      .replace(/##\s(.+)/g, '<h3 style="color:var(--cyan);margin:12px 0 6px;">$1</h3>')
      .replace(/###\s(.+)/g, '<h4 style="color:var(--purple);margin:8px 0 4px;">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold);">$1</strong>')
      .replace(/\n/g, '<br>');
    speak('Code analysis complete. Review the results.');
  } catch(err) {
    output.innerHTML = `<p style="color:var(--red);">❌ ${err.message}</p>`;
    setStatus('idle');
  } finally {
    document.getElementById('runBtn').disabled = false;
  }
}

async function loadFileIntoCode() {
  const paths = await window.KHALLYBEST.browseDialog('file');
  if (!paths?.[0]) return;
  const result = await window.KHALLYBEST.readFile(paths[0]);
  if (result.error) { addMessage(`❌ ${result.error}`, 'KHALLYBEST'); return; }
  document.getElementById('codeInput').value = result.content;
}

async function saveCodeResult() {
  const content = document.getElementById('codeOutput').innerText;
  if (!content || content.includes('Analysis will appear')) return;
  const paths = await window.KHALLYBEST.browseDialog('file');
  if (!paths?.[0]) return;
  await window.KHALLYBEST.writeFile(paths[0], content);
  addMessage(`✅ Result saved to: ${paths[0]}`, 'KHALLYBEST');
}

// ═══════════════════════════════════════════════════════════
//  TERMINAL PANEL
// ═══════════════════════════════════════════════════════════
async function runTermCmd() {
  const cmd = document.getElementById('termInput').value.trim();
  if (!cmd) return;
  document.getElementById('termInput').value = '';
  const out = document.getElementById('termOutput');
  out.innerHTML += `<span class="term-prompt">$</span> <span style="color:#fff;">${escHtml(cmd)}</span><br>`;
  const result = await window.KHALLYBEST.runCommand(cmd);
  if (result.stdout) out.innerHTML += escHtml(result.stdout).replace(/\n/g,'<br>') + '<br>';
  if (result.stderr) out.innerHTML += `<span style="color:var(--red);">${escHtml(result.stderr)}</span><br>`;
  if (result.error && !result.stdout && !result.stderr) out.innerHTML += `<span style="color:var(--red);">Error: ${escHtml(result.error)}</span><br>`;
  out.scrollTop = out.scrollHeight;
}

document.getElementById('termInput')?.addEventListener('keydown', e => {
  if (e.key==='Enter') runTermCmd();
});

function clearTerm() { document.getElementById('termOutput').innerHTML='<span class="term-prompt">KHALLYBEST@system:~$</span> Terminal cleared.<br>'; }
function prefillCmd(cmd) { document.getElementById('termInput').value=cmd; }

// ═══════════════════════════════════════════════════════════
//  APP LAUNCHER
// ═══════════════════════════════════════════════════════════
async function launchApp(name) {
  const result = await window.KHALLYBEST.launchApp(name);
  if (result.error) addMessage(`❌ Could not open ${name}: ${result.error}`, 'KHALLYBEST');
  else addMessage(`✅ Launching ${name}...`, 'KHALLYBEST');
}

async function openUrl(url) { await window.KHALLYBEST.openUrl(url); }

async function launchCustomApp() {
  const name = document.getElementById('customAppInput').value.trim();
  if (!name) return;
  const result = await window.KHALLYBEST.launchApp(name);
  addMessage(result.error ? `❌ Couldn't launch "${name}": ${result.error}` : `✅ Launching "${name}"...`, 'KHALLYBEST');
}

// ═══════════════════════════════════════════════════════════
//  STARFIELD
// ═══════════════════════════════════════════════════════════
(function() {
  const c = document.getElementById('starfield');
  const ctx = c.getContext('2d');
  let stars = [];
  function resize() { c.width=window.innerWidth; c.height=window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  for (let i=0;i<200;i++) stars.push({x:Math.random()*c.width, y:Math.random()*c.height, r:Math.random()*1.4+0.2, a:Math.random(), s:Math.random()*0.005+0.002});
  (function animate() {
    ctx.clearRect(0,0,c.width,c.height);
    stars.forEach(s => { s.a+=s.s; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(200,220,255,${0.25+0.5*Math.abs(Math.sin(s.a))})`; ctx.fill(); });
    requestAnimationFrame(animate);
  })();
})();

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
async function init() {
  setStatus('idle');

  // Populate voices for settings panel
  populateVoices();
  // Some browsers fire voiceschanged asynchronously
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  // Load persisted preferences (name, city, voice settings)
  try {
    const prefs = await window.KHALLYBEST.getPrefs();
    if (prefs.name) KHALLYBEST_CONFIG.PREFS.name = prefs.name;
    if (prefs.city) KHALLYBEST_CONFIG.PREFS.city = prefs.city;
    if (prefs.voiceSettings) {
      _voiceSettings = { ..._voiceSettings, ...prefs.voiceSettings };
      const vs = prefs.voiceSettings;
      if (vs.pitch !== undefined)  { document.getElementById('pitchRange').value = vs.pitch;  document.getElementById('pitchVal').textContent  = vs.pitch; }
      if (vs.rate  !== undefined)  { document.getElementById('rateRange').value  = vs.rate;   document.getElementById('rateVal').textContent   = vs.rate; }
      if (vs.volume !== undefined) { document.getElementById('volRange').value   = vs.volume; document.getElementById('volVal').textContent    = parseFloat(vs.volume).toFixed(2); }
      // voice name applied after voices are loaded
      setTimeout(() => {
        if (vs.voiceName) {
          const sel = document.getElementById('voiceSelect');
          if (sel) sel.value = vs.voiceName;
        }
      }, 600);
    }
  } catch(e) {}

  // Load system info into badge
  try {
    const info = await window.KHALLYBEST.getSystemInfo();
    document.getElementById('sysBadge').innerHTML =
      `👤 ${info.username}<br>🖥️ ${info.hostname}<br>🧠 ${info.freeMem} RAM free`;
  } catch(e) { document.getElementById('sysBadge').textContent = 'System info unavailable'; }

  // Pre-warm microphone permission silently on startup
  setTimeout(async () => {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🎙️ Microphone permission granted on startup.');
    } catch (err) {
      console.warn('🎙️ Mic pre-warm failed:', err.name, '— will retry on first voice click.');
    }
  }, 1500);

  // Welcome message — personalised if name is known
  setTimeout(() => {
    const h    = new Date().getHours();
    const g    = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    const name = KHALLYBEST_CONFIG.PREFS.name;
    const greeting = name ? `${g}, **${name}**` : g;
    const intro    = name
      ? `Welcome back, ${name}! KHALLYBEST is fully online.`
      : `I'm **KHALLYBEST**, your AI desktop assistant by **Spirit Airbone**.`;
    const tip  = name ? '' : '\n\n💬 **Tip:** Say "My name is ..." and I\'ll remember you!';
    const msg  = `${greeting}! ${intro} I have access to your:\n📁 File system  ⚡ Terminal  📱 Phone (ADB)  🧑‍💻 Code analyzer  🌐 Web search${tip}\n\nClick the **🎤 orb** or **mic button** to speak, or type below.`;
    addMessage(msg, 'KHALLYBEST');
    const spoken = name
      ? `${g} ${name}! KHALLYBEST is online and fully operational. How can I help you today?`
      : `${g}! I'm KHALLYBEST, your personal AI desktop assistant. How can I help you today?`;
    speak(spoken);
  }, 800);
}


init();
