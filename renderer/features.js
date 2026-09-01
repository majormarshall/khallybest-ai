// ============================================================
//  KHALLYBEST DESKTOP — New Features v5.0
//  Tasks | News | Notes | Calculator | Sessions | Personas | Models
// ============================================================

// ═══════════════════════════════════════════════════════════
//  MODEL SELECTOR
// ═══════════════════════════════════════════════════════════
function initModelSelector() {
  const sel = document.getElementById('modelSelect');
  if (!sel) return;
  sel.innerHTML = '';
  KHALLYBEST_CONFIG.MODELS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name + (m.badge ? ` [${m.badge}]` : '');
    if (m.id === KHALLYBEST_CONFIG.GROQ_MODEL) opt.selected = true;
    sel.appendChild(opt);
  });
}

function saveModelChoice() {
  const sel = document.getElementById('modelSelect');
  if (!sel) return;
  KHALLYBEST_CONFIG.GROQ_MODEL = sel.value;
  try { window.KHALLYBEST.setPrefs({ model: sel.value }); } catch(e) {}
  const chosen = KHALLYBEST_CONFIG.MODELS.find(m => m.id === sel.value);
  addMessage(`🧠 Model switched to **${chosen?.name || sel.value}**`, 'KHALLYBEST');
}

// ═══════════════════════════════════════════════════════════
//  PERSONA MODES
// ═══════════════════════════════════════════════════════════
let currentPersona = 'default';

function initPersonaGrid() {
  const grid = document.getElementById('personaGrid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.entries(KHALLYBEST_CONFIG.PERSONAS).forEach(([key, p]) => {
    const btn = document.createElement('button');
    btn.className = 'persona-btn' + (key === currentPersona ? ' active' : '');
    btn.textContent = p.name;
    btn.onclick = () => setPersona(key);
    grid.appendChild(btn);
  });
}

function setPersona(key) {
  currentPersona = key;
  localStorage.setItem('kb_persona', key);
  initPersonaGrid();
  const p = KHALLYBEST_CONFIG.PERSONAS[key];
  addMessage(`🎭 Persona set to **${p.name}**`, 'KHALLYBEST');
  speak(`Persona switched to ${p.name.replace(/[^\w\s]/gi,'')}`);
  switchPanel('chat');
}

function getPersonaPrompt() {
  return KHALLYBEST_CONFIG.PERSONAS[currentPersona]?.prompt || '';
}

// ═══════════════════════════════════════════════════════════
//  AUTO-START TOGGLE
// ═══════════════════════════════════════════════════════════
async function initAutoStartToggle() {
  try {
    const result = await window.KHALLYBEST.getAutoStart();
    const toggle = document.getElementById('autoStartToggle');
    if (toggle) toggle.checked = result.enabled;
  } catch(e) {}
}

async function toggleAutoStart(enabled) {
  try {
    await window.KHALLYBEST.setAutoStart(enabled);
    addMessage(`🚀 Auto-start on Windows login: **${enabled ? 'Enabled ✅' : 'Disabled ❌'}**`, 'KHALLYBEST');
  } catch(e) {
    addMessage(`⚠️ Could not change auto-start: ${e.message}`, 'KHALLYBEST');
  }
}

// ═══════════════════════════════════════════════════════════
//  SMART REMINDERS & TASKS
// ═══════════════════════════════════════════════════════════
let tasks = [];

function loadTasks() {
  try { tasks = JSON.parse(localStorage.getItem('kb_tasks') || '[]'); } catch(e) { tasks = []; }
}

function saveTasks() {
  localStorage.setItem('kb_tasks', JSON.stringify(tasks));
}

function addTask() {
  const text = document.getElementById('taskInput')?.value.trim();
  const timeVal = document.getElementById('taskTime')?.value;
  const priority = document.getElementById('taskPriority')?.value || 'normal';
  if (!text) return;
  tasks.push({
    id: Date.now(),
    text,
    dueTime: timeVal ? new Date(timeVal).getTime() : null,
    priority,
    done: false,
    alerted: false,
    created: Date.now()
  });
  saveTasks();
  renderTasks();
  if (document.getElementById('taskInput')) document.getElementById('taskInput').value = '';
  if (document.getElementById('taskTime')) document.getElementById('taskTime').value = '';
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; saveTasks(); renderTasks(); }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  if (!tasks.length) { list.innerHTML = '<p class="ph">No tasks yet. Add one above!</p>'; return; }
  const sorted = [...tasks].sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pOrd = { high: 0, normal: 1, low: 2 };
    return (pOrd[a.priority]||1) - (pOrd[b.priority]||1);
  });
  list.innerHTML = sorted.map(t => {
    const due = t.dueTime ? `<span class="task-due ${Date.now() > t.dueTime && !t.done ? 'overdue' : ''}">⏰ ${new Date(t.dueTime).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>` : '';
    const pIcon = { high:'🔴', normal:'🔵', low:'🟢' }[t.priority] || '🔵';
    return `<div class="task-item ${t.done ? 'done' : ''} priority-${t.priority}">
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${t.id})" />
      <div class="task-body">
        <span class="task-text">${t.text}</span>
        ${due}
      </div>
      <span class="task-priority">${pIcon}</span>
      <button class="task-del" onclick="deleteTask(${t.id})">🗑️</button>
    </div>`;
  }).join('');
}

// Check reminders every 30 seconds
setInterval(() => {
  const now = Date.now();
  tasks.filter(t => !t.done && !t.alerted && t.dueTime && t.dueTime <= now).forEach(t => {
    t.alerted = true;
    saveTasks();
    addMessage(`⏰ **Reminder Due:** ${t.text}`, 'KHALLYBEST');
    speak(`Reminder: ${t.text}`);
    try { new Notification('KHALLYBEST Reminder', { body: t.text, icon: '' }); } catch(e) {}
  });
}, 30000);

// Natural language reminder detection
function detectReminderRequest(input) {
  return /\b(remind me|set reminder|add task|don't forget|remember to)\b/i.test(input);
}

// ═══════════════════════════════════════════════════════════
//  NEWS FEED
// ═══════════════════════════════════════════════════════════
let currentNewsCat = 'general';

async function loadNews(category, btn) {
  currentNewsCat = category;
  document.querySelectorAll('.news-cat').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="news-loading">📡 Loading headlines…</div>';

  try {
    const url = `${KHALLYBEST_CONFIG.NEWS_URL}?category=${category}&pageSize=20&language=en&apiKey=${KHALLYBEST_CONFIG.NEWS_API_KEY}`;
    const res = await nodeFetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = res.json();
    if (!data.articles?.length) { grid.innerHTML = '<p class="ph">No articles found for this category.</p>'; return; }
    grid.innerHTML = data.articles.filter(a => a.title && a.title !== '[Removed]').map(a => `
      <div class="news-card">
        ${a.urlToImage ? `<img class="news-img" src="${a.urlToImage}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        <div class="news-body">
          <div class="news-source">${a.source?.name || 'News'} · ${new Date(a.publishedAt).toLocaleDateString()}</div>
          <div class="news-title">${a.title}</div>
          <div class="news-desc">${a.description || ''}</div>
          <div class="news-actions">
            <button class="tb-btn cyan" onclick="askAboutNews(${JSON.stringify(a.title).replace(/'/g,'&#39;')})">🤖 Ask KHALLYBEST</button>
            <button class="tb-btn" onclick="window.KHALLYBEST.openUrl('${a.url}')">🔗 Read Full</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    grid.innerHTML = `<p class="ph" style="color:var(--red)">❌ ${e.message}<br><small>Check your NewsAPI key in config.js</small></p>`;
  }
}

function askAboutNews(headline) {
  switchPanel('chat');
  processInput(`Tell me more about this news: "${headline}". Give context, analysis, and what it means.`);
}

// ═══════════════════════════════════════════════════════════
//  NOTES / SCRATCH PAD
// ═══════════════════════════════════════════════════════════
let notes = [];
let activeNoteId = null;

function loadNotes() {
  try { notes = JSON.parse(localStorage.getItem('kb_notes') || '[]'); } catch(e) { notes = []; }
}

function saveNotes() {
  localStorage.setItem('kb_notes', JSON.stringify(notes));
}

function createNote() {
  const note = { id: Date.now(), title: 'Untitled Note', content: '', updated: Date.now() };
  notes.unshift(note);
  saveNotes();
  renderNotesList();
  selectNote(note.id);
}

function selectNote(id) {
  activeNoteId = id;
  const note = notes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('noteTitleInput').value = note.title;
  document.getElementById('noteEditor').value = note.content;
  document.querySelectorAll('.note-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id == id);
  });
}

function saveCurrentNote() {
  if (!activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.title = document.getElementById('noteTitleInput')?.value || 'Untitled';
  note.content = document.getElementById('noteEditor')?.value || '';
  note.updated = Date.now();
  saveNotes();
  renderNotesList();
}

function deleteCurrentNote() {
  if (!activeNoteId) return;
  if (!confirm('Delete this note?')) return;
  notes = notes.filter(n => n.id !== activeNoteId);
  activeNoteId = null;
  saveNotes();
  renderNotesList();
  document.getElementById('noteTitleInput').value = '';
  document.getElementById('noteEditor').value = '';
}

function renderNotesList() {
  const list = document.getElementById('notesList');
  if (!list) return;
  if (!notes.length) { list.innerHTML = '<p class="ph" style="font-size:12px">No notes yet</p>'; return; }
  list.innerHTML = notes.map(n => `
    <div class="note-item ${n.id === activeNoteId ? 'active' : ''}" data-id="${n.id}" onclick="selectNote(${n.id})">
      <div class="note-item-title">${n.title}</div>
      <div class="note-item-date">${new Date(n.updated).toLocaleDateString()}</div>
    </div>`).join('');
}

async function aiPolishNote() {
  saveCurrentNote();
  const content = document.getElementById('noteEditor')?.value;
  if (!content?.trim()) { addMessage('Write something in the note first!', 'KHALLYBEST'); return; }
  switchPanel('chat');
  processInput(`Please polish and improve this text, fixing grammar, flow, and clarity while keeping the original meaning:\n\n${content}`);
}

async function aiSummarizeNote() {
  saveCurrentNote();
  const content = document.getElementById('noteEditor')?.value;
  if (!content?.trim()) { addMessage('Write something in the note first!', 'KHALLYBEST'); return; }
  switchPanel('chat');
  processInput(`Please summarize this text in 3-5 bullet points:\n\n${content}`);
}

async function aiTranslateNote() {
  saveCurrentNote();
  const content = document.getElementById('noteEditor')?.value;
  if (!content?.trim()) { addMessage('Write something in the note first!', 'KHALLYBEST'); return; }
  const lang = prompt('Translate to which language? (e.g. French, Yoruba, Arabic)', 'French');
  if (!lang) return;
  switchPanel('chat');
  processInput(`Translate this text to ${lang}:\n\n${content}`);
}

function exportNote() {
  saveCurrentNote();
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const blob = new Blob([`# ${note.title}\n\n${note.content}`], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.md`;
  a.click();
}

// Auto-save notes on typing
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('noteEditor')?.addEventListener('input', saveCurrentNote);
  document.getElementById('noteTitleInput')?.addEventListener('input', saveCurrentNote);
});

// ═══════════════════════════════════════════════════════════
//  CALCULATOR & UNIT CONVERTER
// ═══════════════════════════════════════════════════════════
let calcExpr = '';

function calcInput(val) {
  if (calcExpr === '0' && /\d/.test(val)) calcExpr = val;
  else calcExpr += val;
  document.getElementById('calcDisplay').textContent = calcExpr || '0';
}

function calcClear() {
  calcExpr = '';
  document.getElementById('calcDisplay').textContent = '0';
  document.getElementById('calcExpr').textContent = '';
}

function calcBackspace() {
  calcExpr = calcExpr.slice(0, -1);
  document.getElementById('calcDisplay').textContent = calcExpr || '0';
}

function calcEval() {
  if (!calcExpr) return;
  try {
    // Safe math eval — only allow numbers and operators
    if (!/^[\d\s\+\-\*\/\.\(\)\^%]+$/.test(calcExpr.replace(/\*\*/g,'**'))) {
      document.getElementById('calcDisplay').textContent = 'Error';
      return;
    }
    const safeExpr = calcExpr.replace(/\^/g, '**');
    const result = Function('"use strict"; return (' + safeExpr + ')')();
    document.getElementById('calcExpr').textContent = `${calcExpr} =`;
    calcExpr = String(parseFloat(result.toFixed(10)));
    document.getElementById('calcDisplay').textContent = calcExpr;
  } catch(e) {
    document.getElementById('calcDisplay').textContent = 'Error';
    calcExpr = '';
  }
}

// Keyboard support for calculator
document.addEventListener('keydown', (e) => {
  if (currentPanel !== 'calc') return;
  if (/^[\d\+\-\*\/\.\(\)]$/.test(e.key)) calcInput(e.key);
  else if (e.key === 'Enter' || e.key === '=') calcEval();
  else if (e.key === 'Backspace') calcBackspace();
  else if (e.key === 'Escape') calcClear();
});

// Unit Converter
const CONV_UNITS = {
  temp:     ['°C', '°F', 'K'],
  length:   ['m', 'km', 'cm', 'mm', 'mile', 'yard', 'foot', 'inch'],
  weight:   ['kg', 'g', 'lb', 'oz', 'ton'],
  currency: ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'],
};

const CONV_RATES = {
  length: { m:1, km:0.001, cm:100, mm:1000, mile:0.000621371, yard:1.09361, foot:3.28084, inch:39.3701 },
  weight: { kg:1, g:1000, lb:2.20462, oz:35.274, ton:0.001 },
  currency: { NGN:1, USD:0.00065, GBP:0.00052, EUR:0.00060, GHS:0.0098, KES:0.085, ZAR:0.012 },
};

function updateConvUnits() {
  const type = document.getElementById('convType')?.value;
  const units = CONV_UNITS[type] || [];
  ['convFromUnit', 'convToUnit'].forEach((id, i) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
    if (i === 1 && units[1]) sel.value = units[1];
  });
}

function doConvert() {
  const type = document.getElementById('convType')?.value;
  const from = document.getElementById('convFromUnit')?.value;
  const to = document.getElementById('convToUnit')?.value;
  const val = parseFloat(document.getElementById('convFrom')?.value);
  const outEl = document.getElementById('convTo');
  if (isNaN(val) || !outEl) return;

  let result;
  if (type === 'temp') {
    if (from === '°C' && to === '°F') result = val * 9/5 + 32;
    else if (from === '°F' && to === '°C') result = (val - 32) * 5/9;
    else if (from === '°C' && to === 'K') result = val + 273.15;
    else if (from === 'K' && to === '°C') result = val - 273.15;
    else if (from === '°F' && to === 'K') result = (val - 32) * 5/9 + 273.15;
    else if (from === 'K' && to === '°F') result = (val - 273.15) * 9/5 + 32;
    else result = val;
  } else {
    const rates = CONV_RATES[type];
    if (!rates) return;
    const inBase = val / (rates[from] || 1);
    result = inBase * (rates[to] || 1);
  }
  outEl.value = parseFloat(result.toFixed(6));
}

// ═══════════════════════════════════════════════════════════
//  CHAT SESSIONS
// ═══════════════════════════════════════════════════════════
let chatSessions = [];

function loadChatSessions() {
  try { chatSessions = JSON.parse(localStorage.getItem('kb_sessions') || '[]'); } catch(e) { chatSessions = []; }
}

function saveChatSessions() {
  localStorage.setItem('kb_sessions', JSON.stringify(chatSessions));
}

function saveSession() {
  const nameInput = document.getElementById('sessionNameInput');
  const name = nameInput?.value.trim() || `Session ${new Date().toLocaleDateString()}`;
  const session = {
    id: Date.now(),
    name,
    date: Date.now(),
    html: document.getElementById('chatLog')?.innerHTML || '',
    history: JSON.stringify(conversationHistory),
    msgCount: _msgCount || 0,
  };
  chatSessions.unshift(session);
  if (chatSessions.length > 20) chatSessions = chatSessions.slice(0, 20);
  saveChatSessions();
  if (nameInput) nameInput.value = '';
  renderSessions();
  addMessage(`💾 Session **"${name}"** saved!`, 'KHALLYBEST');
}

function loadSession(id) {
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;
  if (!confirm(`Load session "${session.name}"? Current chat will be lost.`)) return;
  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.innerHTML = session.html;
  try { conversationHistory = JSON.parse(session.history || '[]'); } catch(e) { conversationHistory = []; }
  _msgCount = session.msgCount || 0;
  updateCounter();
  switchPanel('chat');
  addMessage(`📂 Session **"${session.name}"** loaded!`, 'KHALLYBEST');
}

function deleteSession(id) {
  if (!confirm('Delete this session?')) return;
  chatSessions = chatSessions.filter(s => s.id !== id);
  saveChatSessions();
  renderSessions();
}

function renderSessions() {
  const list = document.getElementById('sessionsList');
  if (!list) return;
  if (!chatSessions.length) { list.innerHTML = '<p class="ph">No saved sessions yet.</p>'; return; }
  list.innerHTML = chatSessions.map(s => `
    <div class="session-item">
      <div class="session-info">
        <div class="session-name">${s.name}</div>
        <div class="session-date">${new Date(s.date).toLocaleString()} · ${s.msgCount} msgs</div>
      </div>
      <div class="session-actions">
        <button class="tb-btn cyan" onclick="loadSession(${s.id})">📂 Load</button>
        <button class="tb-btn" onclick="deleteSession(${s.id})" style="color:var(--red)">🗑️</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
//  INIT ALL NEW FEATURES
// ═══════════════════════════════════════════════════════════
function initNewFeatures() {
  // Persona
  currentPersona = localStorage.getItem('kb_persona') || 'default';
  initPersonaGrid();
  initModelSelector();
  initAutoStartToggle();

  // Load persisted data
  loadTasks();
  renderTasks();
  loadNotes();
  renderNotesList();
  loadChatSessions();
  renderSessions();

  // Init converter units
  updateConvUnits();

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Detect reminder in chat input
  const origProcessInput = window._origProcessInput || processInput;
  // Patch processInput to auto-create tasks from natural language
}

// Call after DOM is ready
document.addEventListener('DOMContentLoaded', initNewFeatures);
