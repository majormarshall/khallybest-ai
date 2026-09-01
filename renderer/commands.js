// ============================================================
//  KHALLYBEST — Skills & Commands (Jarvis Edition)
// ============================================================

// ── Secure fetch helper (routes through Node IPC, no CORS) ──
// All external requests in this file must use cmdFetch, NOT fetch()
async function cmdFetch(url, opts) {
  const res = await window.KHALLYBEST.netFetch(url, opts || {});
  return {
    ok:     res.ok,
    status: res.status,
    text:   res.text,
    json:   () => JSON.parse(res.text),
  };
}

// ── Reminder Store ────────────────────────────────────────
const REMINDERS = [];
const ALARMS    = [];

function scheduleReminder(text, ms) {
  const id = setTimeout(() => {
    addMessage(`⏰ **REMINDER:** ${text}`, 'KHALLYBEST');
    speak(`Reminder: ${text}`);
  }, ms);
  REMINDERS.push({ text, id, due: Date.now() + ms });
  return id;
}

// ── All Built-in Commands ─────────────────────────────────
const COMMANDS = {

  // ── TIME & DATE ──────────────────────────────────────────
  time: {
    patterns: [/what.*time/i, /current time/i, /tell me the time/i],
    handler() {
      const t = new Date();
      return `It's **${t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})}**. Every second counts.`;
    }
  },
  date: {
    patterns: [/what.*date/i, /what day/i, /today.*date/i, /day.*today/i],
    handler() {
      const d = new Date();
      return `Today is **${d.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}**. Day ${Math.ceil((d-(new Date(d.getFullYear(),0,1)))/86400000)} of the year.`;
    }
  },

  // ── GREETING ─────────────────────────────────────────────
  greeting: {
    patterns: [/^(hello|hi|hey|good morning|good afternoon|good evening|salamu|ekaro|ndewo)/i],
    handler() {
      const h    = new Date().getHours();
      const g    = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
      const name = KHALLYBEST_CONFIG.PREFS.name ? `, **${KHALLYBEST_CONFIG.PREFS.name}**` : '';
      const lines = [
        `${g}${name}! KHALLYBEST online. All systems nominal. What shall we accomplish today?`,
        `${g}${name}! I've been monitoring things. Ready when you are.`,
        `${g}${name}! KHALLYBEST at your service. What do you need?`
      ];
      return lines[Math.floor(Math.random()*lines.length)];
    }
  },

  // ── IDENTITY ─────────────────────────────────────────────
  identity: {
    patterns: [/who are you/i, /what are you/i, /introduce yourself/i, /your name/i, /what can you do/i, /capabilities/i],
    handler() {
      return `I am **KHALLYBEST** — your personal AI desktop assistant.\n\n**What I can do:**\n🗣️ Natural conversation in 4 languages\n🔍 Wikipedia, Google, Reddit & web search\n📰 Live news from BBC & multiple sources\n🌤️ Real-time weather for any city\n📁 Full file system access\n⚡ Run terminal commands on your PC\n📱 Control your Android phone via ADB\n🧑‍💻 Analyze, debug, edit & optimize code\n⏰ Set reminders and alarms\n🚀 Launch any app on your PC\n💰 Live stock, crypto & forex data\n📝 Draft emails and messages\n🧮 Engineering and physics calculations\n\nJust speak or type — I handle the rest.`;
    }
  },

  // ── SYSTEM INFO ──────────────────────────────────────────
  systemInfo: {
    patterns: [/system info/i, /my (pc|computer|specs|system)/i, /system health/i, /hardware/i],
    async handler() {
      const info = await window.KHALLYBEST.getSystemInfo();
      return `**System Report:**\n🖥️ Host: ${info.hostname}\n👤 User: ${info.username}\n💻 CPU Cores: ${info.cpus}\n🧠 RAM: ${info.freeMem} free of ${info.totalMem}\n⏱️ Uptime: ${info.uptime}\n🏗️ Architecture: ${info.arch}\n🟢 Node.js: ${info.nodeVer}`;
    }
  },

  // ── WEATHER (uses Node proxy) ─────────────────────────────
  weather: {
    patterns: [/weather/i, /temperature/i, /how.*outside/i, /forecast/i, /rain/i, /hot.*today/i],
    async handler(input) {
      try {
        // Get city from input or detect via IP
        const cityMatch = input.match(/weather\s+(?:in\s+)?([a-zA-Z\s]{2,20})/i);
        let city = (cityMatch?.[1] || '').trim();

        if (!city) {
          // Auto-detect city via IP geolocation
          const geo = await cmdFetch('https://ipapi.co/json/');
          if (geo.ok) {
            const g = geo.json();
            city = g.city || 'Lagos';
          } else {
            city = 'Lagos';
          }
        }

        const res = await cmdFetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        if (!res.ok) return '🌡️ Weather unavailable right now.';
        const d  = res.json();
        const c  = d.current_condition[0];
        const a  = d.nearest_area[0];
        return `**🌤️ Weather — ${a.areaName[0].value}, ${a.country[0].value}:**\n${c.weatherDesc[0].value} | **${c.temp_C}°C** (feels like ${c.FeelsLikeC}°C)\n💧 Humidity: ${c.humidity}% | 💨 Wind: ${c.windspeedKmph} km/h | ☀️ UV: ${c.uvIndex}\n\n📅 3-Day Forecast:\n${d.weather.slice(0,3).map((w,i)=>`• ${i===0?'Today':i===1?'Tomorrow':'Day after'}: ${w.maxtempC}°↑ ${w.mintempC}°↓ — ${w.hourly?.[4]?.weatherDesc?.[0]?.value||''}`).join('\n')}`;
      } catch(e) { return '🌡️ Weather unavailable. Check your internet.'; }
    }
  },

  // ── NEWS (uses Node proxy) ────────────────────────────────
  news: {
    patterns: [/\bnews\b/i, /headlines/i, /what.*happening/i, /current events/i],
    async handler() {
      try {
        const res = await cmdFetch('https://feeds.bbci.co.uk/news/rss.xml');
        if (!res.ok) throw new Error('Feed failed');
        // Parse RSS XML manually (no DOMParser needed — extract titles with regex)
        const titles = [...res.text.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>|<title>(.+?)<\/title>/g)]
          .map(m => (m[1] || m[2]).trim())
          .filter(t => t && !t.toLowerCase().includes('bbc'))
          .slice(0, 6);
        if (!titles.length) throw new Error('No titles');
        return `**📰 Latest BBC Headlines:**\n${titles.map((t,i)=>`${i+1}. ${t}`).join('\n')}\n\n_Say "search [topic]" to get more details on any story._`;
      } catch {
        return '📰 Could not fetch news. Try: "search latest tech news" for web search.';
      }
    }
  },

  // ── STOCKS / CRYPTO (uses Node proxy) ────────────────────
  stocks: {
    patterns: [/stock|crypto|bitcoin|ethereum|btc|eth|price of|market|forex|dollar|naira/i],
    async handler(input) {
      try {
        const map  = { bitcoin:'bitcoin', btc:'bitcoin', ethereum:'ethereum', eth:'ethereum', bnb:'binancecoin', sol:'solana', doge:'dogecoin' };
        const word = input.toLowerCase().match(/bitcoin|btc|ethereum|eth|bnb|solana|sol|doge/)?.[0];
        const id   = map[word] || 'bitcoin';
        const res  = await cmdFetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,ngn&include_24hr_change=true`);
        if (!res.ok) throw new Error();
        const coin = res.json()[id];
        const change = coin.usd_24h_change?.toFixed(2);
        const arrow  = change > 0 ? '📈' : '📉';
        return `💰 **${id.charAt(0).toUpperCase()+id.slice(1)}:**\n🇺🇸 $${coin.usd.toLocaleString()} USD  ${arrow} ${change}% (24h)\n🇳🇬 ₦${coin.ngn?.toLocaleString()} NGN`;
      } catch { return '📈 Market data unavailable right now.'; }
    }
  },

  // ── MULTI-SOURCE SEARCH (Wikipedia + DuckDuckGo + Reddit) ─
  search: {
    patterns: [/^search\b|^google\b|^look up\b|^find\b|search for|google for|search on|reddit|social media search/i],
    async handler(input) {
      const q = input
        .replace(/^(search for|search on|search|google for|google|look up|find)\s+/i, '')
        .replace(/\s+on (google|reddit|twitter|youtube|social media)$/i, '')
        .trim();

      if (!q) return '🔍 What would you like me to search for?';

      addMessage(`🔍 Searching for: **${q}**...`, 'KHALLYBEST');

      const results = [];

      // ── 1. Wikipedia ──────────────────────────────────────
      try {
        const wRes = await cmdFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
        if (wRes.ok) {
          const w = wRes.json();
          if (w.extract && w.type !== 'disambiguation') {
            results.push(`📚 **Wikipedia — ${w.title}**\n${w.extract.split('.').slice(0,3).join('.')+'.'}${w.content_urls?.desktop?.page ? `\n🔗 [Read more](${w.content_urls.desktop.page})` : ''}`);
          }
        }
      } catch {}

      // ── 2. DuckDuckGo Instant Answer ─────────────────────
      try {
        const dRes = await cmdFetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`);
        if (dRes.ok) {
          const d = dRes.json();
          const snippets = [];
          if (d.Answer)       snippets.push(`💡 **Instant Answer:** ${d.Answer}`);
          if (d.AbstractText) snippets.push(`🌐 **${d.Heading || 'Web Result'}:** ${d.AbstractText.substring(0,300)}${d.AbstractText.length > 300 ? '...' : ''}`);
          (d.RelatedTopics||[]).slice(0,3).forEach(t => { if (t.Text) snippets.push(`• ${t.Text.substring(0,150)}`); });
          if (snippets.length) results.push(`🦆 **DuckDuckGo Results:**\n${snippets.join('\n')}`);
        }
      } catch {}

      // ── 3. Reddit ─────────────────────────────────────────
      try {
        const rRes = await cmdFetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=3&sort=relevance`);
        if (rRes.ok) {
          const r = rRes.json();
          const posts = r.data?.children?.slice(0,3).map(p =>
            `• r/${p.data.subreddit}: **${p.data.title.substring(0,80)}** (${p.data.score} upvotes)`
          ) || [];
          if (posts.length) results.push(`📱 **Reddit Discussions:**\n${posts.join('\n')}`);
        }
      } catch {}

      // ── 4. Browser Search Links ───────────────────────────
      const encoded = encodeURIComponent(q);
      const links = [
        { label: 'Google',    url: `https://www.google.com/search?q=${encoded}` },
        { label: 'YouTube',   url: `https://www.youtube.com/results?search_query=${encoded}` },
        { label: 'Twitter/X', url: `https://twitter.com/search?q=${encoded}` },
        { label: 'Reddit',    url: `https://www.reddit.com/search/?q=${encoded}` },
      ];

      const linksBlock = `🔗 **Open in browser:**\n${links.map(l => `• [${l.label}](${l.url})`).join('\n')}`;
      results.push(linksBlock);

      if (results.length <= 1) {
        // Only got links — tell user to open browser
        await window.KHALLYBEST.openUrl(`https://www.google.com/search?q=${encoded}`);
        return `🔍 Opening Google search for: **${q}**\n\nAlso try: "search ${q} on reddit"`;
      }

      return results.join('\n\n─────────────────────\n\n');
    }
  },

  // ── WIKIPEDIA DIRECT LOOKUP ───────────────────────────────
  wiki: {
    patterns: [/what is|who is|who was|define|explain|tell me about|history of/i],
    async handler(input) {
      try {
        const q   = input.replace(/what is|who is|who was|define|explain|tell me about|history of/gi,'').trim();
        if (!q || q.length < 2) return null;
        const res = await cmdFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
        if (!res.ok) return null;
        const data = res.json();
        if (data.type === 'disambiguation' || !data.extract) return null; // fall through to Groq
        return `📚 **${data.title}**\n${data.extract.split('.').slice(0,4).join('.')+'.'}\n\n_Source: Wikipedia_`;
      } catch { return null; }
    }
  },

  // ── CALCULATOR ───────────────────────────────────────────
  calculate: {
    patterns: [/calculate|what is \d|\d+\s*[\+\-\*\/]\s*\d|how much is \d|square root|percentage/i],
    handler(input) {
      try {
        const expr = input.replace(/what is|calculate|compute|how much is/gi,'')
                         .replace(/square root of (\d+)/i, 'Math.sqrt($1)')
                         .replace(/(\d+)\s*percent of\s*(\d+)/i, '($1/100)*$2')
                         .replace(/[^0-9\+\-\*\/\.\(\)MathsqrtpowPI\s]/g,'').trim();
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict";return('+expr+')')();
        return `🔢 **${expr} = ${Number(result.toFixed(8))}**`;
      } catch { return null; }
    }
  },

  // ── OPEN WEBSITE ─────────────────────────────────────────
  openSite: {
    patterns: [/open (google|youtube|github|twitter|facebook|instagram|whatsapp|linkedin|reddit|amazon|netflix)/i],
    async handler(input) {
      const sites = {google:'https://google.com',youtube:'https://youtube.com',github:'https://github.com',twitter:'https://x.com',facebook:'https://facebook.com',instagram:'https://instagram.com',whatsapp:'https://web.whatsapp.com',linkedin:'https://linkedin.com',reddit:'https://reddit.com',amazon:'https://amazon.com',netflix:'https://netflix.com'};
      const m = input.match(/open (\w+)/i);
      const k = m?.[1]?.toLowerCase();
      if (k && sites[k]) { await window.KHALLYBEST.openUrl(sites[k]); return `🌐 Opening **${k}**...`; }
      return null;
    }
  },

  // ── LAUNCH APP ───────────────────────────────────────────
  launch: {
    patterns: [/open|launch|start\s+(notepad|calculator|paint|word|excel|chrome|firefox|vscode|vs code|spotify|whatsapp)/i],
    async handler(input) {
      const m = input.match(/(?:open|launch|start)\s+(.+)/i);
      if (!m) return null;
      const result = await window.KHALLYBEST.launchApp(m[1].trim());
      return result.error ? `❌ Can't open: ${result.error}` : `🚀 Launching **${m[1].trim()}**...`;
    }
  },

  // ── REMINDER ─────────────────────────────────────────────
  reminder: {
    patterns: [/remind me|set.*reminder|alarm|remind.*in/i],
    handler(input) {
      const minMatch = input.match(/(\d+)\s*minute/i);
      const hrMatch  = input.match(/(\d+)\s*hour/i);
      const secMatch = input.match(/(\d+)\s*second/i);
      let ms = 0;
      if (minMatch) ms += parseInt(minMatch[1]) * 60000;
      if (hrMatch)  ms += parseInt(hrMatch[1])  * 3600000;
      if (secMatch) ms += parseInt(secMatch[1]) * 1000;
      if (ms === 0) return "⏰ Specify a time. Example: 'Remind me in 10 minutes to drink water'";
      const textMatch = input.match(/remind(?:er)?\s*(?:me)?\s*(?:to|about|in\s*\d+\s*\w+\s*(?:to|about)?)?\s*(.+)/i);
      const reminder  = textMatch?.[1]?.replace(/in \d+ (minute|hour|second)s?/i,'').trim() || 'reminder';
      scheduleReminder(reminder, ms);
      const timeStr = hrMatch ? `${hrMatch[1]} hour(s)` : minMatch ? `${minMatch[1]} minute(s)` : `${secMatch[1]} second(s)`;
      return `⏰ **Reminder set!** I'll alert you in ${timeStr}:\n"${reminder}"`;
    }
  },

  // ── ENGINEERING CALC ─────────────────────────────────────
  engineering: {
    patterns: [/ohm|volt|watt|newton|force|pressure|velocity|acceleration|resistor|capacitor|frequency|wavelength/i],
    handler() { return null; } // Falls through to Groq with engineering knowledge
  },

  // ── JOKES ────────────────────────────────────────────────
  joke: {
    patterns: [/joke|make me laugh|funny|humor/i],
    handler() {
      const j = [
        "Why do programmers prefer dark mode? Because **light attracts bugs!** 😂",
        "A SQL query walks into a bar, up to two tables: 'Can I **join** you?' 🍺",
        "Why do Java devs wear glasses? They don't **C#**! 👓",
        "I told my computer I needed a break. Now it won't stop showing Kit-Kat ads. 😄",
        "Why did the dev go broke? He used up all his **cache**! 💸",
        "There are 10 types of people: those who understand binary and those who don't. 🤓"
      ];
      return j[Math.floor(Math.random()*j.length)];
    }
  },

  // ── MOTIVATION ───────────────────────────────────────────
  inspire: {
    patterns: [/inspir|motivat|quote|encourage|uplift/i],
    handler() {
      const q = [
        '"The only way to do great work is to love what you do." — Steve Jobs',
        '"First solve the problem, then write the code." — John Johnson',
        '"An investment in knowledge pays the best interest." — Benjamin Franklin',
        '"The best time to plant a tree was 20 years ago. The second best time is now." — Proverb',
        '"Success is not final, failure is not fatal: it is the courage to continue that counts." — Churchill',
        '"Code is like humor. When you have to explain it, it\'s bad." — Cory House'
      ];
      return q[Math.floor(Math.random()*q.length)];
    }
  },

  // ── REMEMBER ME (persistent) ──────────────────────────────
  learnName: {
    patterns: [/my name is|call me|i am called|i'm called|you can call me|remember my name|remember me as|my friends call me/i],
    async handler(input) {
      const m = input.match(/(?:my name is|call me|i am called|i'm called|you can call me|remember my name as|remember me as|my friends call me)\s+([\w'-]+)/i);
      if (m) {
        const name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
        KHALLYBEST_CONFIG.PREFS.name = name;
        try { await window.KHALLYBEST.setPrefs({ name }); } catch(e) {}
        const responses = [
          `Noted and saved! I'll always call you **${name}** from now on. Great to officially meet you, ${name}! 🤝`,
          `Got it, **${name}**! I've saved your name — I'll remember it even after a restart. Welcome aboard! 🎉`,
          `**${name}** — logged and stored. I'll address you by name from this moment forward. It's a pleasure, ${name}! ✅`,
        ];
        return responses[Math.floor(Math.random()*responses.length)];
      }
      return null;
    }
  },

  // ── DRAFT EMAIL ──────────────────────────────────────────
  email: {
    patterns: [/draft.*email|write.*email|compose.*message|write.*message|email.*to/i],
    handler() { return null; } // Falls through to Groq for drafting
  },

  // ── STATUS ───────────────────────────────────────────────
  status: {
    patterns: [/status|how are you|all good|operational|online/i],
    handler() {
      const name = KHALLYBEST_CONFIG.PREFS.name ? `, ${KHALLYBEST_CONFIG.PREFS.name}` : '';
      return `All systems operational${name}. ✅\n⚡ AI Brain: Groq Llama 3.3 70B\n🎙️ Voice: Web Speech API + Windows Offline\n🔍 Search: Wikipedia + DuckDuckGo + Reddit\n📁 File System: Full Access\n📱 Phone: Ready (ADB)\n⏰ Reminders: ${REMINDERS.length} active\n🧠 Memory: ${conversationHistory?.length || 0} exchanges this session`;
    }
  },

  // ── GOODBYE ──────────────────────────────────────────────
  bye: {
    patterns: [/goodbye|bye|see you|take care|good night|shut down/i],
    handler() {
      const name = KHALLYBEST_CONFIG.PREFS.name || 'friend';
      return `Goodbye, ${name}! KHALLYBEST standing by whenever you need me. Stay sharp. 👋`;
    }
  }
};

// ── Command Router ────────────────────────────────────────
async function runBuiltinCommand(input) {
  for (const [, cmd] of Object.entries(COMMANDS)) {
    if (cmd.patterns.some(p => p.test(input))) {
      const result = await cmd.handler(input);
      if (result !== null && result !== undefined) return result;
    }
  }
  return null; // → fall through to Groq
}
