// ============================================================
//  KHALLYBEST WEB — App Logic v3.0
//  Chat History | Typing Animation | File Drop | PWA
// ============================================================

// ── State ────────────────────────────────────────────────
let isListening = false, isSpeaking = false, currentPanel = 'chat';
let recognition = null, conversationHistory = [];
let _voiceSettings = { voiceName: '', pitch: 0.85, rate: 0.92, volume: 1.0 };
let _msgCount = 0;

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

// ── Browser / Feature Detection ───────────────────────────
const HAS_SPEECH_RECOGNITION = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const IS_FIREFOX = navigator.userAgent.toLowerCase().includes('firefox');
const IS_MOBILE  = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

// ── Status ────────────────────────────────────────────────
function setStatus(s) {
  const noSpeech = !HAS_SPEECH_RECOGNITION;
  const m = {
    idle:      {cls:'',          txt:'IDLE',      orb:'',          wave:false, hint: noSpeech ? 'TYPE TO CHAT' : 'TAP ORB TO SPEAK'},
    listening: {cls:'listening', txt:'LISTENING', orb:'listening', wave:true,  hint:'LISTENING...'},
    thinking:  {cls:'thinking',  txt:'THINKING',  orb:'thinking',  wave:false, hint:'PROCESSING...'},
    speaking:  {cls:'speaking',  txt:'SPEAKING',  orb:'speaking',  wave:true,  hint:'SPEAKING...'},
  }[s] || {cls:'',txt:'IDLE',orb:'',wave:false,hint: noSpeech ? 'TYPE TO CHAT' : 'TAP ORB TO SPEAK'};
  statusDot.className    = `status-dot ${m.cls}`;
  statusText.textContent = m.txt;
  orbCore.className      = `orb-core ${m.orb}`;
  waveform.className     = `waveform ${m.wave?'active':''}`;
  orbHint.textContent    = m.hint;
  if (micBtn) micBtn.classList.toggle('active', s === 'listening');
}

// ── Render Message with Code Highlighting ─────────────────
function renderMarkdown(text) {
  // Code blocks with language
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const l = lang || 'code';
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const isHtml = ['html','htm'].includes(l.toLowerCase());
    const previewBtn = isHtml ? `<button class="preview-btn" onclick="previewHTML(this)" title="Live preview">▶ Preview</button>` : '';
    return `<div class="code-block-wrap">
      <div class="code-block-header">
        <span class="code-lang">${l.toUpperCase()}</span>
        <div class="code-actions">
          ${previewBtn}
          <button class="copy-btn" onclick="copyCode(this)" title="Copy code">📋 Copy</button>
        </div>
      </div>
      <pre class="code-block"><code>${escaped}</code></pre>
    </div>`;
  });
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Headings
  text = text.replace(/^### (.*?)$/gm, '<h4 class="md-h4">$1</h4>');
  text = text.replace(/^## (.*?)$/gm, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^# (.*?)$/gm, '<h2 class="md-h2">$1</h2>');
  // Unordered lists
  text = text.replace(/^[-*] (.*?)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  // Numbered lists
  text = text.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
  // Line breaks
  text = text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  return text;
}

// ── Copy Code ────────────────────────────────────────────
function copyCode(btn) {
  const pre = btn.closest('.code-block-wrap').querySelector('pre code');
  const text = pre.innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
  });
}

// ── Typing Indicator ─────────────────────────────────────
function showTyping() {
  if (document.getElementById('typingIndicator')) return;
  const wrap = document.createElement('div');
  wrap.className = 'msg KHALLYBEST'; wrap.id = 'typingIndicator';
  wrap.innerHTML = '<div class="avatar">K</div><div class="bubble typing-bubble"><span class="td"></span><span class="td"></span><span class="td"></span></div>';
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function hideTyping() {
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

// ── Chat History ──────────────────────────────────────────
function saveChatHistory() {
  try {
    localStorage.setItem('kb_chat_html', chatLog.innerHTML);
    localStorage.setItem('kb_history',   JSON.stringify(conversationHistory));
    localStorage.setItem('kb_msgcount',  String(_msgCount));
  } catch(e) {}
}
function loadChatHistory() {
  try {
    const html = localStorage.getItem('kb_chat_html');
    const hist = localStorage.getItem('kb_history');
    const cnt  = localStorage.getItem('kb_msgcount');
    if (html && html.length > 10) {
      chatLog.innerHTML = html;
      conversationHistory = hist ? JSON.parse(hist) : [];
      _msgCount = cnt ? parseInt(cnt) : 0;
      updateCounter();
      chatLog.scrollTop = chatLog.scrollHeight;
      return true;
    }
  } catch(e) {}
  return false;
}
function clearChat() {
  if (!confirm('Clear all chat history? This cannot be undone.')) return;
  chatLog.innerHTML = ''; conversationHistory = []; _msgCount = 0;
  localStorage.removeItem('kb_chat_html');
  localStorage.removeItem('kb_history');
  localStorage.removeItem('kb_msgcount');
  updateCounter();
  addMessage('🗑️ Chat cleared. I\'m ready for a fresh start!', 'KHALLYBEST');
}
function exportChat() {
  const msgs = Array.from(chatLog.querySelectorAll('.msg')).map(m => {
    const who  = m.classList.contains('user') ? '**You**' : '**KHALLYBEST**';
    const txt  = m.querySelector('.bubble')?.innerText?.replace(/\n\d{1,2}:\d{2}\s*(AM|PM)?$/,'').trim() || '';
    return `### ${who}\n${txt}`;
  }).join('\n\n---\n\n');
  const header = `# KHALLYBEST Chat Export\n_${new Date().toLocaleString()}_ · by Spirit Airbone\n\n---\n\n`;
  const blob = new Blob([header + msgs], {type:'text/markdown'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `KHALLYBEST-chat-${Date.now()}.md`; a.click();
}
function updateCounter() {
  const el = document.getElementById('msgCounter');
  if (el) el.textContent = `${_msgCount} message${_msgCount !== 1 ? 's' : ''}`;
}

// ── Add Chat Message ──────────────────────────────────────
function addMessage(text, sender='KHALLYBEST') {
  hideTyping();
  const wrap   = document.createElement('div');
  wrap.className = `msg ${sender}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = sender === 'user' ? 'U' : 'K';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = renderMarkdown(text);
  const ts = document.createElement('span');
  ts.className = 'msg-ts';
  ts.textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  bubble.appendChild(ts);
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (sender === 'user' || sender === 'KHALLYBEST') { _msgCount++; updateCounter(); }
  saveChatHistory();
}

// ── Real-Time Context (browser native fetch) ──────────────
async function fetchRealTimeContext(input) {
  const q = input.toLowerCase();
  let context = '';

  try {
    // Date / Time — always inject
    const now = new Date();
    context += `\n[CURRENT DATE & TIME]\nDate: ${now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}\nTime: ${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

    // Weather — via wttr.in (CORS-friendly)
    const wMatch = q.match(/weather(?:\s+in\s+|\s+for\s+|\s+of\s+)?([a-z ]{2,25})|([a-z ]{2,25})\s+weather|forecast\s+(?:for\s+)?([a-z ]{2,25})/);
    if (wMatch || /\b(temperature|forecast|rain|sunny|hot outside|cold outside|humidity)\b/.test(q)) {
      const city = (wMatch?.[1] || wMatch?.[2] || wMatch?.[3] || '').trim() || 'Lagos';
      addMessage(`🌤️ Fetching live weather for **${city}**...`, 'KHALLYBEST');
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      if (res.ok) {
        const d = await res.json();
        const c = d.current_condition[0], a = d.nearest_area[0];
        context += `\n[LIVE WEATHER — ${a.areaName[0].value}, ${a.country[0].value}]\nTemp: ${c.temp_C}°C / ${c.temp_F}°F (feels like ${c.FeelsLikeC}°C)\nCondition: ${c.weatherDesc[0].value}\nHumidity: ${c.humidity}% | Wind: ${c.windspeedKmph} km/h\n3-day: ${d.weather.slice(0,3).map(w=>`${w.date}: ${w.maxtempC}°C/${w.mintempC}°C`).join(' | ')}`;
      }
    }

    // Crypto
    const coinMap = { bitcoin:'bitcoin',btc:'bitcoin',ethereum:'ethereum',eth:'ethereum',bnb:'binancecoin',solana:'solana',sol:'solana',dogecoin:'dogecoin',doge:'dogecoin',xrp:'ripple',ripple:'ripple',cardano:'cardano',ada:'cardano',usdt:'tether',pepe:'pepe' };
    const coinMatch = q.match(/\b(bitcoin|btc|ethereum|eth|bnb|solana|sol|dogecoin|doge|xrp|ripple|cardano|ada|usdt|pepe)\b/);
    if (coinMatch) {
      const id = coinMap[coinMatch[1]];
      addMessage(`📈 Fetching live **${coinMatch[1].toUpperCase()}** price...`, 'KHALLYBEST');
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,ngn&include_24hr_change=true`);
      if (res.ok) {
        const d = await res.json();
        if (d[id]) context += `\n[LIVE CRYPTO — ${id.toUpperCase()}]\nUSD: $${d[id].usd?.toLocaleString()} | NGN: ₦${d[id].ngn?.toLocaleString()}\n24h Change: ${d[id].usd_24h_change?.toFixed(2)}%`;
      }
    }

    // DuckDuckGo web/Google-style search (broader triggers)
    if (/\b(news|latest|recent|search|find|look up|what happened|who is|who won|currently|right now|google|tell me about|info on|information about|what is|linkedin|twitter|instagram|tiktok|youtube|social media|profile of|trending|viral)\b/.test(q)) {
      addMessage(`🔍 Searching the web for: **${input.substring(0,60)}**...`, 'KHALLYBEST');
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`);
      if (res.ok) {
        const d = await res.json();
        const snippets = [];
        if (d.Answer)       snippets.push(`⚡ Instant Answer: ${d.Answer}`);
        if (d.AbstractText) snippets.push(`📄 ${d.Heading}: ${d.AbstractText}`);
        if (d.AbstractURL)  snippets.push(`🔗 Source: ${d.AbstractURL}`);
        (d.RelatedTopics||[]).slice(0,5).forEach(t => { if (t.Text) snippets.push(`• ${t.Text}`); });
        if (snippets.length) context += `\n[WEB SEARCH RESULTS — "${input.substring(0,50)}"]\n${snippets.join('\n')}`;
      }
    }

    // LinkedIn & Social Media profile lookup
    if (/\b(linkedin|facebook|twitter|instagram|tiktok|social)\b/.test(q) && /\b(profile|account|page|handle|bio|about|find)\b/.test(q)) {
      const nameMatch2 = input.match(/(?:linkedin|twitter|instagram|tiktok).*?(?:of|for|about)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
      if (nameMatch2) {
        context += `\n[SOCIAL MEDIA CONTEXT]\nSearching for professional profile: ${nameMatch2[1]}\nNote: Provide best available info from training data and suggest checking live profile URLs directly.`;
      }
    }

  } catch(e) { /* silent fallback */ }

  return context;
}

// ── Groq AI ───────────────────────────────────────────────
async function askGroq(userInput, extra = '') {
  const lang  = KHALLYBEST_CONFIG.LANGUAGES[langSelect.value] || 'English';
  const rtCtx = await fetchRealTimeContext(userInput);

  const messages = [
    {
      role: 'system',
      content: KHALLYBEST_CONFIG.SYSTEM_PROMPT +
        `\nCurrent date/time: ${new Date().toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).` +
        (KHALLYBEST_CONFIG.PREFS.name ? `\nThe user's name is ${KHALLYBEST_CONFIG.PREFS.name}. Address them naturally.` : '') +
        (rtCtx ? `\n\nREAL-TIME DATA FOR THIS QUERY:${rtCtx}` : '') +
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
      const res = await fetch(KHALLYBEST_CONFIG.GROQ_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KHALLYBEST_CONFIG.GROQ_API_KEY}` },
        body:    JSON.stringify({ model: KHALLYBEST_CONFIG.GROQ_MODEL, messages, max_tokens: 4000, temperature: 0.85 }),
      });

      if (res.status === 429) { await new Promise(r => setTimeout(r, (attempt + 1) * 5000)); continue; }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }

      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content || "I'm having trouble responding. Please try again.";
      conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
      return reply;

    } catch (err) {
      if (attempt === 2) {
        const reply = `⚠️ AI error: ${err.message}\n\nCheck your **Groq API key** in ⚙️ Settings.`;
        conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
        return reply;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

// ── Streaming Groq ────────────────────────────────────────
function createStreamingBubble() {
  hideTyping();
  const wrap = document.createElement('div');
  wrap.className = 'msg KHALLYBEST';
  const avatar = document.createElement('div');
  avatar.className = 'avatar'; avatar.textContent = 'K';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrap.appendChild(avatar); wrap.appendChild(bubble);
  chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight;
  return { wrap, bubble };
}

async function streamGroq(userInput, bubbleEl, extra = '') {
  const lang  = KHALLYBEST_CONFIG.LANGUAGES[langSelect.value] || 'English';
  const rtCtx = await fetchRealTimeContext(userInput);
  const messages = [
    { role:'system', content: KHALLYBEST_CONFIG.SYSTEM_PROMPT +
        `\nCurrent date/time: ${new Date().toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).` +
        (KHALLYBEST_CONFIG.PREFS.name ? `\nUser name: ${KHALLYBEST_CONFIG.PREFS.name}.` : '') +
        (typeof getPersonaPrompt === 'function' ? `\n${getPersonaPrompt()}` : '') +
        (rtCtx ? `\n\nREAL-TIME DATA:${rtCtx}` : '') +
        `\nRespond in ${lang}. ${extra}`.trim() },
    ...conversationHistory.map(h => ({ role: h.role==='model'?'assistant':h.role, content: h.parts[0].text })),
    { role:'user', content: userInput }
  ];
  conversationHistory.push({ role:'user', parts:[{text:userInput}] });

  const res = await fetch(KHALLYBEST_CONFIG.GROQ_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${KHALLYBEST_CONFIG.GROQ_API_KEY}`},
    body: JSON.stringify({model:KHALLYBEST_CONFIG.GROQ_MODEL, messages, max_tokens:4000, temperature:0.85, stream:true})
  });
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.error?.message||`HTTP ${res.status}`); }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '', renderTimer = null;
  hideTyping();

  const flush = (final=false) => {
    bubbleEl.innerHTML = renderMarkdown(fullText) + (final ? '' : '<span class="cursor-blink">▌</span>');
    chatLog.scrollTop = chatLog.scrollHeight;
    renderTimer = null;
  };

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, {stream:true}).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) { fullText += delta; if (!renderTimer) renderTimer = setTimeout(flush, 30); }
      } catch(e) {}
    }
  }
  if (renderTimer) clearTimeout(renderTimer);
  flush(true);
  conversationHistory.push({ role:'model', parts:[{text:fullText}] });
  return fullText;
}

// ── Image Generation (Pollinations.ai — free, no key) ─────
function detectImageRequest(q) {
  return /\b(generate|create|draw|show|make|paint|design|give me)\s+(?:an?\s+)?(?:image|picture|photo|artwork|illustration|portrait|logo|icon|banner|wallpaper)\b/i.test(q)
    || /\b(?:image|picture|photo|artwork|illustration)\s+of\b/i.test(q)
    || /\bvisualize\b/i.test(q);
}

async function generateImage(input) {
  const prompt = input.replace(/generate|create|draw|show me|make|paint|design|give me|an image of|a picture of|a photo of|artwork of|illustration of|visualize/gi,'').trim() || input;
  const statusMsg = addRawBubble(`🎨 Generating: **${prompt}**…`);
  setStatus('thinking');
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&nologo=true&model=flux&seed=${Date.now()}`;
    await new Promise((res,rej) => { const i=new Image(); i.onload=res; i.onerror=rej; i.src=url; });
    if (statusMsg) statusMsg.remove();
    const wrap = document.createElement('div');
    wrap.className = 'msg KHALLYBEST';
    wrap.innerHTML = `<div class="avatar">K</div><div class="bubble"><img src="${url}" class="gen-img" alt="${prompt}" onclick="openImgFull('${url}')"/><div class="img-meta">🎨 &ldquo;${prompt}&rdquo; &nbsp;·&nbsp; <a href="${url}" download="KHALLYBEST-art.jpg" class="img-dl" target="_blank">⬇ Download</a> &nbsp;·&nbsp; <span class="img-zoom" onclick="openImgFull('${url}')">🔍 Fullscreen</span></div></div>`;
    chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight;
    _msgCount++; updateCounter(); saveChatHistory();
    setStatus('idle'); speak(`Here is the image of ${prompt}`);
  } catch(e) {
    if (statusMsg) statusMsg.remove();
    addMessage(`⚠️ Image generation failed. Try a different prompt!`, 'KHALLYBEST');
    setStatus('idle');
  }
}

function addRawBubble(text) {
  const wrap = document.createElement('div'); wrap.className='msg KHALLYBEST';
  wrap.innerHTML=`<div class="avatar">K</div><div class="bubble">${renderMarkdown(text)}</div>`;
  chatLog.appendChild(wrap); chatLog.scrollTop=chatLog.scrollHeight;
  return wrap;
}

function openImgFull(url) {
  const m=document.getElementById('imgModal'), i=document.getElementById('imgModalImg');
  if(m&&i){i.src=url; m.classList.add('active');}
}
function closeImgModal() { document.getElementById('imgModal')?.classList.remove('active'); }

// ── HTML Live Preview ─────────────────────────────────────
function previewHTML(btn) {
  const code = btn.closest('.code-block-wrap').querySelector('.code-block code').innerText;
  const m=document.getElementById('previewModal'), f=document.getElementById('previewFrame');
  if(m&&f){f.srcdoc=code; m.classList.add('active');}
}
function closePreview() { document.getElementById('previewModal')?.classList.remove('active'); }

// ── TTS ───────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // Strip markdown/code before speaking
  const clean = text
    .replace(/```[\s\S]*?```/g, 'Here is the code.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g,'')
    .replace(/\*\*/g,'')
    .replace(/\*/g,'')
    .replace(/#{1,4} /g,'')
    .replace(/\n/g,' ')
    .trim();
  if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);

  const pitch   = parseFloat(document.getElementById('pitchRange')?.value  ?? _voiceSettings.pitch);
  const rate    = parseFloat(document.getElementById('rateRange')?.value   ?? _voiceSettings.rate);
  const volume  = parseFloat(document.getElementById('volRange')?.value    ?? _voiceSettings.volume);
  const selName = document.getElementById('voiceSelect')?.value            || _voiceSettings.voiceName;

  utt.pitch  = pitch;
  utt.rate   = rate;
  utt.volume = volume;
  utt.lang   = 'en-US';

  const voices = window.speechSynthesis.getVoices();
  if (selName) {
    const picked = voices.find(v => v.name === selName);
    if (picked) utt.voice = picked;
  } else {
    const male = voices.find(v =>
      v.name.includes('David') || v.name.includes('Daniel') ||
      v.name.toLowerCase().includes('male') || v.name.includes('Google UK English Male')
    );
    if (male) utt.voice = male;
  }

  utt.onstart = () => { isSpeaking=true;  setStatus('speaking'); };
  utt.onend   = () => { isSpeaking=false; setStatus('idle'); };
  utt.onerror = () => { isSpeaking=false; setStatus('idle'); };
  window.speechSynthesis.speak(utt);
}

// ── Voice Settings ────────────────────────────────────────
function populateVoices() {
  const sel  = document.getElementById('voiceSelect');
  const info = document.getElementById('voiceListInfo');
  if (!sel) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">🎲 Auto (best available)</option>';
  const rows = [];
  voices.forEach(v => {
    const opt  = document.createElement('option');
    opt.value  = v.name;
    const flag = v.lang.startsWith('en') ? '🇬🇧' : v.lang.startsWith('fr') ? '🇫🇷' :
                 v.lang.startsWith('es') ? '🇪🇸' : v.lang.startsWith('de') ? '🇩🇪' : '🌐';
    opt.textContent = `${flag} ${v.name} (${v.lang})`;
    if (v.name === prev || (!prev && (v.name.includes('David') || v.name.includes('Daniel')))) opt.selected = true;
    sel.appendChild(opt);
    rows.push(`<span style="color:var(--cyan);">${flag} ${v.name}</span> <span style="color:var(--muted);">(${v.lang}) ${v.localService ? '• offline' : '• online'}</span>`);
  });
  if (info) info.innerHTML = rows.join('<br>');
}

function testVoice() {
  speak('Hello! I am KHALLYBEST, built by Spirit Airbone. How does my voice sound?');
}

function saveVoiceSettings() {
  _voiceSettings.voiceName = document.getElementById('voiceSelect')?.value || '';
  _voiceSettings.pitch     = parseFloat(document.getElementById('pitchRange')?.value || 0.85);
  _voiceSettings.rate      = parseFloat(document.getElementById('rateRange')?.value  || 0.92);
  _voiceSettings.volume    = parseFloat(document.getElementById('volRange')?.value   || 1.0);
  localStorage.setItem('KHALLYBEST_voice', JSON.stringify(_voiceSettings));
  addMessage(`✅ Voice saved: **${_voiceSettings.voiceName || 'Auto'}** | Pitch ${_voiceSettings.pitch} | Speed ${_voiceSettings.rate}`, 'KHALLYBEST');
  switchPanel('chat');
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput')?.value.trim();
  if (!key) return;
  localStorage.setItem('KHALLYBEST_api_key', key);
  addMessage('✅ Groq API key saved! KHALLYBEST is fully operational.', 'KHALLYBEST');
  switchPanel('chat');
}

// ── Process Input ─────────────────────────────────────────
let _lastInput = '';
const _origTitle = document.title;
async function processInput(input) {
  if (!input.trim()) return;
  switchPanel('chat');
  _lastInput = input;

  if (detectImageRequest(input)) {
    addMessage(input, 'user'); _msgCount++; updateCounter(); saveChatHistory();
    await generateImage(input);
    return;
  }

  addMessage(input, 'user');
  setStatus('thinking');
  showTyping();
  try {
    const nameMatch = input.match(/my name is ([a-zA-Z ]+)/i);
    if (nameMatch) KHALLYBEST_CONFIG.PREFS.name = nameMatch[1].trim();
    const { wrap, bubble } = createStreamingBubble();
    const reply = await streamGroq(input, bubble);
    // Timestamp on streamed bubble
    const ts = document.createElement('span');
    ts.className = 'msg-ts';
    ts.textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    bubble.appendChild(ts);
    addRegenButton(wrap, input);
    _msgCount++; updateCounter(); saveChatHistory();
    // Tab notification
    if (document.hidden) {
      document.title = '✨ KHALLYBEST replied!';
      const restore = () => { document.title = _origTitle; document.removeEventListener('visibilitychange', restore); };
      document.addEventListener('visibilitychange', restore);
    }
    // Context length warning
    if (_msgCount > 0 && _msgCount % 20 === 0) showContextWarning();
    speak(reply);
    setStatus('idle');
    // Resume wake word AFTER TTS finishes so KHALLYBEST's voice doesn't re-trigger it
    // We hook into speechSynthesis end — wait a safe 2s margin
    if (wakeActive) setTimeout(() => {
      if (wakeActive && !isListening && !isSpeaking) {
        try { wakeRecognition?.start(); } catch(e){}
      }
    }, 2000);
  } catch (err) {
    hideTyping();
    addMessage(`⚠️ Error: ${err.message}`, 'KHALLYBEST');
    setStatus('idle');
  }
}

function showContextWarning() {
  if (document.getElementById('ctxWarn')) return;
  const bar = document.createElement('div');
  bar.id = 'ctxWarn'; bar.className = 'ctx-warn';
  bar.innerHTML = '⚠️ Long conversation — responses may get less accurate. <button onclick="compressHistory()">📦 Compress</button><button onclick="document.getElementById(\u0027ctxWarn\u0027).remove()">✕</button>';
  chatLog.parentElement.insertBefore(bar, chatLog);
}
function compressHistory() {
  conversationHistory = conversationHistory.slice(-10);
  document.getElementById('ctxWarn')?.remove();
  addMessage('📦 History compressed — kept last 5 exchanges. Context is fresh again!', 'KHALLYBEST');
  saveChatHistory();
}

function sendText() {
  const v = textInput.value.trim();
  if (!v) return;
  textInput.value = '';
  processInput(v);
}
textInput.addEventListener('keydown', e => { if(e.key==='Enter' && !e.shiftKey) sendText(); });
function quickCommand(text) { processInput(text); }

// ── Voice Recognition ─────────────────────────────────────
function toggleListening() {
  if (!HAS_SPEECH_RECOGNITION) {
    addMessage(
      '🦊 **Firefox / this browser doesn\'t support voice input.**\n\n' +
      '✅ All other features work perfectly — just **type your message** below!\n\n' +
      '💡 _For voice: try Chrome or Edge._',
      'KHALLYBEST'
    );
    textInput.focus();
    return;
  }
  if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; }
  isListening ? stopListening() : startListening();
}

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  recognition = new SR();
  const speechLangMap = { 'en-US':'en-US', 'ha':'en-NG', 'yo':'en-NG', 'ig':'en-NG' };
  recognition.lang          = speechLangMap[langSelect.value] || 'en-US';
  recognition.continuous    = false;
  recognition.interimResults = false;

  recognition.onresult = e => {
    const t = e.results[0][0].transcript;
    stopListening();
    processInput(t);
  };

  recognition.onerror = e => {
    const msgs = {
      'not-allowed':   '🎙️ Microphone blocked. Allow mic access in browser settings.',
      'no-speech':     '🎙️ No speech detected. Try again.',
      'audio-capture': '🎙️ No microphone found.',
      'aborted':       null,
    };
    stopListening();
    const msg = msgs[e.error];
    if (msg) addMessage(msg, 'KHALLYBEST');
  };

  recognition.onend = () => { if (isListening) stopListening(); };

  try {
    recognition.start();
    isListening = true;
    setStatus('listening');
  } catch (err) {
    addMessage(`🎙️ Voice error: ${err.message}`, 'KHALLYBEST');
    setStatus('idle');
  }
}

function stopListening() {
  try { recognition?.stop(); } catch(e) {}
  isListening = false;
  setStatus('idle');
  // Resume wake word after manual mic stop (not after voice triggers — those wait for TTS)
  if (wakeActive) setTimeout(() => {
    if (wakeActive && !isListening) {
      try { wakeRecognition?.start(); } catch(e){}
    }
  }, 900);
}

// ── Wake Word ────────────────────────────────────────────
let wakeRecognition = null, wakeActive = false;

function initWakeWord() {
  if (!HAS_SPEECH_RECOGNITION) return;
  try {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    wakeRecognition = new SR();
    wakeRecognition.continuous = true;
    wakeRecognition.interimResults = true;
    wakeRecognition.lang = 'en-US';
    wakeRecognition.maxAlternatives = 3;

    wakeRecognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (/\b(hey\s+kali|hey\s+KHALLYBEST|ok\s+KHALLYBEST|KHALLYBEST|hey\s+kali\s*best)\b/.test(t)) {
          handleWakeDetected();
          break;
        }
      }
    };
    wakeRecognition.onend = () => {
      // Re-check isListening INSIDE the callback (not before queuing)
      // Prevents stealing the mic when main recognition is active
      if (wakeActive) setTimeout(() => {
        if (wakeActive && !isListening) {
          try { wakeRecognition.start(); } catch(e){}
        }
      }, 700);
    };
    wakeRecognition.onerror = (e) => {
      if (['no-speech','aborted','network'].includes(e.error) && wakeActive) {
        setTimeout(() => {
          if (wakeActive && !isListening) {
            try { wakeRecognition.start(); } catch(e){}
          }
        }, 1400);
      }
    };
  } catch(err) { console.warn('Wake word init failed:', err); }
}

function handleWakeDetected() {
  if (isListening) return;
  try { wakeRecognition?.stop(); } catch(e) {}

  // ── Voice biometrics check ──────────────────────────────
  if (typeof VoiceBiometrics !== 'undefined' && VoiceBiometrics.isEnrolled()) {
    // Run verification asynchronously — give mic 400ms to release
    setTimeout(async () => {
      const ok = await VoiceBiometrics.verify();
      if (!ok) {
        // Voice does not match — flash red, do NOT activate
        orbCore.classList.add('thinking');
        setTimeout(() => { if (!isListening) orbCore.classList.remove('thinking'); }, 800);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 220; gain.gain.setValueAtTime(0.10, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch(e) {}
        console.log('[VoiceBiometrics] Voice did not match. Wake rejected.');
        // Resume wake listener
        if (wakeActive) setTimeout(() => { try { wakeRecognition?.start(); } catch(e){} }, 900);
        return;
      }
      // Voice matched — proceed normally
      _activateAfterWake();
    }, 400);
  } else {
    // No enrollment — skip verification
    _activateAfterWake();
  }
}

function _activateAfterWake() {
  // Flash the orb green
  orbCore.classList.add('listening');
  setTimeout(() => { if (!isListening) orbCore.classList.remove('listening'); }, 400);
  // Confirmation beep
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch(e) {}
  setTimeout(() => startListening(), 600);
}

function toggleWakeWord() {
  wakeActive = !wakeActive;
  const btn = document.getElementById('wakeBtn');
  if (wakeActive) {
    try { wakeRecognition?.start(); } catch(e){}
    if (btn) btn.classList.add('active');
    addMessage('👂 **Wake word activated!** Say **“Hey KHALLYBEST”** anytime to talk without touching anything.', 'KHALLYBEST');
  } else {
    try { wakeRecognition?.abort(); } catch(e){}
    if (btn) btn.classList.remove('active');
    addMessage('💤 Wake word disabled.', 'KHALLYBEST');
  }
  localStorage.setItem('kb_wake', wakeActive ? '1' : '0');
}

// ── Apply no-speech UI ─────────────────────────────────────
function applyNoSpeechUI() {
  if (micBtn) {
    micBtn.title         = 'Voice not supported — use text input';
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor  = 'not-allowed';
  }
  orbHint.textContent = 'TYPE TO CHAT';
  orbCore.title       = 'Voice unsupported — type below';
  const badge = document.getElementById('sysBadge');
  if (badge) badge.innerHTML = '🌐 KHALLYBEST Web<br/>🤖 LLaMA 3 · Groq<br/>⌨️ Text Mode';
  textInput.placeholder = 'Type your message here…';
}

// ── File Drop & Read ─────────────────────────────────────
function formatBytes(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB';}

async function handleFiles(files) {
  switchPanel('chat');
  for (const f of files) await processFile(f);
}

async function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const isImg  = /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(ext);
  const isPDF  = ext === 'pdf';
  const isText = /^(txt|md|js|ts|jsx|tsx|py|html|css|json|csv|xml|yaml|yml|sh|bat|sql|c|cpp|h|java|php|rb|go|rs|swift|kt|vue|svelte|toml|env|log|gitignore|ini|cfg|conf|scss|sass)$/.test(ext);

  addMessage(`📎 File dropped: **${file.name}** (${formatBytes(file.size)})`, 'user');

  if (isImg) {
    const url = URL.createObjectURL(file);
    const wrap = document.createElement('div');
    wrap.className = 'msg KHALLYBEST';
    wrap.innerHTML = `<div class="avatar">K</div><div class="bubble"><img src="${url}" style="max-width:100%;max-height:280px;border-radius:10px;display:block;border:1px solid var(--border)" alt="${file.name}"/><br><span style="font-size:11px;color:var(--muted)">📸 ${file.name} · ${formatBytes(file.size)}</span></div>`;
    chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight; saveChatHistory();
    processInput(`I dropped an image called "${file.name}". Please acknowledge it and ask me what I'd like to do — describe, analyze, edit, or generate something based on it.`);
  } else if (isPDF) {
    addMessage(`📄 Reading **${file.name}** (PDF)…`, 'KHALLYBEST');
    try {
      if (!window.pdfjsLib) throw new Error('PDF.js not loaded');
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: buf}).promise;
      let text = '';
      const maxP = Math.min(pdf.numPages, 10);
      for (let i=1;i<=maxP;i++) {
        const pg = await pdf.getPage(i);
        const ct = await pg.getTextContent();
        text += ct.items.map(x=>x.str).join(' ') + '\n';
      }
      if (pdf.numPages > 10) text += `\n[... ${pdf.numPages-10} more pages not shown]`;
      const trunc = text.length > 8000 ? text.substring(0,8000)+'\n[truncated]' : text;
      processInput(`I dropped a PDF: **${file.name}** (${pdf.numPages} pages).\n\nExtracted text:\n${trunc}\n\nPlease summarize this document and tell me how you can help with it.`);
    } catch(err) {
      addMessage(`⚠️ PDF read error: ${err.message}. Paste the text content and I'll help!`, 'KHALLYBEST');
    }
  } else if (isText || file.type.startsWith('text/')) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const trunc = content.length > 8000 ? content.substring(0,8000)+'\n[truncated]' : content;
      processInput(`I dropped a file: **${file.name}**\n\nContent:\n\`\`\`${ext}\n${trunc}\n\`\`\`\n\nPlease analyze this, explain what it does, spot any issues, and ask how you can help.`);
    };
    reader.readAsText(file);
  } else {
    addMessage(`⚠️ **${file.name}** — I can read: text files, code, JSON, CSV, PDF, and images. Tell me what you need help with and paste any relevant content!`, 'KHALLYBEST');
  }
}

function initFileDrop() {
  const overlay = document.getElementById('dropOverlay');
  if (!overlay) return;
  let dragCounter = 0;
  document.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; overlay.classList.add('active'); });
  document.addEventListener('dragleave', e => { dragCounter--; if (dragCounter <= 0) { dragCounter=0; overlay.classList.remove('active'); } });
  document.addEventListener('dragover',  e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault(); dragCounter = 0; overlay.classList.remove('active');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  });
}

// ── PWA Registration + Update Detection ─────────────────
function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // Poll for updates every 30s (helps on mobile where tabs stay open)
    setInterval(() => reg.update(), 30000);

    // When a new SW is found installing
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // New version ready — tell it to skip waiting and take over
          newSW.postMessage({ type: 'SKIP_WAITING' });
          showUpdateToast();
        }
      });
    });
  }).catch(() => {});

  // When new SW takes control, reload to serve fresh files
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  });
}

function showUpdateToast() {
  if (document.getElementById('kbUpdateToast')) return;
  const toast = document.createElement('div');
  toast.id = 'kbUpdateToast';
  toast.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
    'background:linear-gradient(135deg,#00d4ff,#0066ff)', 'color:#000',
    'padding:12px 22px', 'border-radius:12px',
    'font-family:var(--font-body,sans-serif)',
    'font-size:13px', 'font-weight:700',
    'box-shadow:0 4px 24px rgba(0,212,255,0.5)',
    'z-index:99999', 'cursor:pointer', 'white-space:nowrap',
    'animation:fadeIn 0.3s ease'
  ].join(';');
  toast.innerHTML = '✨ KHALLYBEST updated! Tap to reload →';
  toast.onclick = () => window.location.reload();
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 12000);
}

// ── Regenerate Response ───────────────────────────────────
function addRegenButton(wrap, userInput) {
  const btn = document.createElement('button');
  btn.className = 'regen-btn'; btn.textContent = '🔄 Regenerate';
  btn.onclick = () => regenerateResponse(btn, wrap, userInput);
  wrap.appendChild(btn);
}
async function regenerateResponse(btn, wrap, userInput) {
  btn.remove();
  const bubble = wrap.querySelector('.bubble');
  if (!bubble) return;
  bubble.innerHTML = '';
  // Strip last model + user turns added by streamGroq
  const li = conversationHistory.map(h=>h.role).lastIndexOf('model');
  if (li !== -1) conversationHistory.splice(li, 1);
  const lu = conversationHistory.map(h=>h.role).lastIndexOf('user');
  if (lu !== -1) conversationHistory.splice(lu, 1);
  try {
    setStatus('thinking');
    const reply = await streamGroq(userInput, bubble);
    addRegenButton(wrap, userInput);
    saveChatHistory(); speak(reply); setStatus('idle');
  } catch(e) {
    bubble.innerHTML = renderMarkdown(`⚠️ Regeneration failed: ${e.message}`);
    setStatus('idle');
  }
}

// ── Color Theme Switcher ──────────────────────────────────
const THEMES = {
  cyan:    {'--cyan':'#00d4ff','--blue':'#0066ff','--gc':'0 0 20px rgba(0,212,255,0.5)','--border':'rgba(0,212,255,0.15)'},
  purple:  {'--cyan':'#a855f7','--blue':'#7c3aed','--gc':'0 0 20px rgba(168,85,247,0.5)','--border':'rgba(168,85,247,0.15)'},
  gold:    {'--cyan':'#fbbf24','--blue':'#d97706','--gc':'0 0 20px rgba(251,191,36,0.5)','--border':'rgba(251,191,36,0.15)'},
  emerald: {'--cyan':'#10b981','--blue':'#059669','--gc':'0 0 20px rgba(16,185,129,0.5)','--border':'rgba(16,185,129,0.15)'},
};
function setTheme(name) {
  const t = THEMES[name] || THEMES.cyan;
  Object.entries(t).forEach(([k,v]) => document.documentElement.style.setProperty(k,v));
  localStorage.setItem('kb_theme', name);
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
  document.querySelector(`.theme-dot[data-theme="${name}"]`)?.classList.add('active');
}
function loadTheme() { setTheme(localStorage.getItem('kb_theme') || 'cyan'); }

// ── Onboarding ────────────────────────────────────────────
function initOnboarding() {
  const modal = document.getElementById('onboardModal');
  if (!modal) return;
  const isFirstRun = !localStorage.getItem('kb_user_setup');
  const hasChat    = !!localStorage.getItem('kb_chat_html');
  if (isFirstRun && !hasChat) setTimeout(() => modal.classList.add('active'), 700);
}
function completeOnboarding() {
  const name = document.getElementById('onboardName')?.value.trim();
  const city = document.getElementById('onboardCity')?.value.trim();
  if (name) { KHALLYBEST_CONFIG.PREFS.name = name; localStorage.setItem('kb_user_name', name); }
  if (city) { KHALLYBEST_CONFIG.PREFS.city = city; localStorage.setItem('kb_user_city', city); }
  localStorage.setItem('kb_user_setup', '1');
  document.getElementById('onboardModal')?.classList.remove('active');
  const h = new Date().getHours();
  const g = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  setTimeout(() => {
    addMessage(`${name?`${g}, **${name}**!`:`${g}!`} Welcome to **KHALLYBEST v3.0**!\n\n${city?`🌤️ I'll use **${city}** for weather by default.\n\n`:''}🖥️ Code & vibe coding  🔍 Web search  🎨 Image generation  📎 File analysis\n\nWhat would you like to do?`, 'KHALLYBEST');
    speak(`${name?`Hello ${name}!`:'Hello!'} I'm KHALLYBEST, ready to assist.`);
  }, 300);
}

// ── Panel Switcher ────────────────────────────────────────

function switchPanel(name) {
  currentPanel = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panelEl = document.getElementById(`panel${name.charAt(0).toUpperCase()+name.slice(1)}`);
  const navEl   = document.getElementById(`nav${name.charAt(0).toUpperCase()+name.slice(1)}`);
  if (panelEl) panelEl.classList.remove('hidden');
  if (navEl)   navEl.classList.add('active');
}

// ── Mobile Sidebar Toggle ─────────────────────────────────
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.sidebar');
  const toggle  = document.getElementById('sidebarToggle');
  if (IS_MOBILE && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
    sidebar.classList.remove('open');
  }
});

// ── Starfield ─────────────────────────────────────────────
(function() {
  const c = document.getElementById('starfield');
  if (!c) return;
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

// ── Init ──────────────────────────────────────────────────
function init() {
  setStatus('idle');
  loadTheme();
  registerPWA();
  initFileDrop();
  initOnboarding();

  // Restore saved prefs
  const savedName = localStorage.getItem('kb_user_name');
  const savedCity = localStorage.getItem('kb_user_city');
  if (savedName) KHALLYBEST_CONFIG.PREFS.name = savedName;
  if (savedCity) KHALLYBEST_CONFIG.PREFS.city = savedCity;

  if (window.speechSynthesis) {
    populateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined)
      window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  try {
    const saved = JSON.parse(localStorage.getItem('KHALLYBEST_voice') || '{}');
    if (saved.pitch  !== undefined) { document.getElementById('pitchRange').value = saved.pitch;  document.getElementById('pitchVal').textContent  = saved.pitch; }
    if (saved.rate   !== undefined) { document.getElementById('rateRange').value  = saved.rate;   document.getElementById('rateVal').textContent   = saved.rate; }
    if (saved.volume !== undefined) { document.getElementById('volRange').value   = saved.volume; document.getElementById('volVal').textContent    = parseFloat(saved.volume).toFixed(2); }
    if (saved.voiceName) setTimeout(() => { document.getElementById('voiceSelect').value = saved.voiceName; }, 600);
    _voiceSettings = { ..._voiceSettings, ...saved };
  } catch(e) {}

  const storedKey = localStorage.getItem('KHALLYBEST_api_key');
  if (storedKey && document.getElementById('apiKeyInput'))
    document.getElementById('apiKeyInput').value = storedKey;

  if (!HAS_SPEECH_RECOGNITION) applyNoSpeechUI();

  // Init wake word
  initWakeWord();
  if (localStorage.getItem('kb_wake') === '1' && HAS_SPEECH_RECOGNITION) {
    setTimeout(() => toggleWakeWord(), 1500);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'l') { e.preventDefault(); clearChat(); }
    if (e.key === 'Escape') { window.speechSynthesis?.cancel(); isSpeaking = false; setStatus('idle'); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); textInput.focus();
    }
  });

  // Restore saved chat or show welcome
  const restored = loadChatHistory();
  if (!restored && localStorage.getItem('kb_user_setup')) {
    setTimeout(() => {
      const h = new Date().getHours();
      const g = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
      const name = KHALLYBEST_CONFIG.PREFS.name;
      const noVoice = !HAS_SPEECH_RECOGNITION;
      const greeting = name ? `${g}, **${name}**!` : `${g}!`;
      const msg = `${greeting} I'm **KHALLYBEST**, your AI assistant by **Spirit Airbone**.\n\n🖥️ Code  🔍 Search  🎨 Image Gen  📎 File Analysis  👂 Wake Word\n\n` +
        (noVoice ? `⌨️ _Type below — all features operational._` : `🎤 _Tap orb, say "Hey KHALLYBEST", or type below._`);
      addMessage(msg, 'KHALLYBEST');
      speak(`${name ? `Hello again ${name}!` : 'Hello!'} KHALLYBEST is online.`);
    }, 800);
  }
}

init();
