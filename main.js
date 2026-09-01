// ============================================================
//  KHALLYBEST — Electron Main Process v5.0
//  Controls: window creation, IPC, system operations, auto-start
// ============================================================
const { app, BrowserWindow, ipcMain, dialog, shell, net } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const http   = require('http');
const https  = require('https');
const { exec } = require('child_process');
const dns    = require('dns');

let mainWindow;
const PORT = 7430; // Local server port

// ── Built-in HTTP Server ─────────────────────────────────
// Serves renderer files from http://localhost:PORT
// This gives the page a real http:// origin so Web Speech API works
const MIME = {
  '.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.ico':'image/x-icon',
};

function startLocalServer() {
  const rendererDir = path.join(__dirname, 'renderer');
  const server = http.createServer((req, res) => {
    let filePath = path.join(rendererDir, req.url === '/' ? 'index.html' : req.url);
    // Prevent path traversal
    if (!filePath.startsWith(rendererDir)) { res.writeHead(403); res.end('Forbidden'); return; }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
  server.listen(PORT, '127.0.0.1');
  return server;
}

// ── Create Window ─────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#050a15',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'KHALLYBEST — AI Assistant',
  });

  // ── Grant microphone & media permissions automatically ──
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowed = ['media', 'microphone', 'audioCapture', 'notifications'];
      callback(allowed.includes(permission));
    }
  );

  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission) => {
      const allowed = ['media', 'microphone', 'audioCapture', 'notifications'];
      return allowed.includes(permission);
    }
  );

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);

  // Open DevTools to see errors
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.openDevTools();
  });
}

app.whenReady().then(() => {
  startLocalServer();
  createWindow();

  // ── Auto-start on Windows Login ───────────────────────────
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false,
      name: 'KHALLYBEST',
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ═══════════════════════════════════════════════════════════
//  IPC HANDLERS — All system operations requested by renderer
// ═══════════════════════════════════════════════════════════

// ── Offline Voice Recognition (Windows System.Speech) ─────
ipcMain.handle('offline-listen', async () => {
  const tmpScript = path.join(os.tmpdir(), 'KHALLYBEST_voice.ps1');

  // Write the PowerShell script to a temp file (avoids quote escaping issues)
  const psScript = `
Add-Type -AssemblyName System.Speech
try {
  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $grammar = New-Object System.Speech.Recognition.DictationGrammar
  $engine.LoadGrammar($grammar)
  $engine.SetInputToDefaultAudioDevice()
  $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(6)
  $engine.BabbleTimeout = [TimeSpan]::FromSeconds(12)
  $engine.EndSilenceTimeout = [TimeSpan]::FromSeconds(2)
  $result = $engine.Recognize()
  $engine.Dispose()
  if ($result -and $result.Text) {
    Write-Output $result.Text
  } else {
    Write-Output "[silence]"
  }
} catch {
  Write-Output "[error]:$($_.Exception.Message)"
}
`.trim();

  fs.writeFileSync(tmpScript, psScript, 'utf8');

  return new Promise(resolve => {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`,
      { timeout: 25000 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpScript); } catch(e) {}
        const raw = (stdout || '').trim();
        if (raw.startsWith('[error]:')) {
          resolve({ text: null, error: raw.replace('[error]:', '') });
        } else if (!raw || raw === '[silence]') {
          resolve({ text: null, error: 'No speech detected' });
        } else {
          resolve({ text: raw });
        }
      }
    );
  });
});

// ── Check internet connectivity (DNS-based — most reliable) ──
// DNS resolution works regardless of HTTPS certs, firewalls, or port blocks.
// If we can resolve a well-known hostname, the device has internet.
ipcMain.handle('check-online', async () => {
  return new Promise(resolve => {
    let settled = false;
    const done = (online) => { if (!settled) { settled = true; resolve({ online }); } };

    // Try resolving google.com and cloudflare.com in parallel
    dns.resolve('google.com',     (err) => { if (!err) done(true); });
    dns.resolve('cloudflare.com', (err) => { if (!err) done(true); });
    dns.resolve('api.groq.com',   (err) => { if (!err) done(true); });

    // Also try a quick TCP connection to Cloudflare DNS (port 53)
    const net = require('net');
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.connect(53, '1.1.1.1', () => { sock.destroy(); done(true); });
    sock.on('error',   () => sock.destroy());
    sock.on('timeout', () => sock.destroy());

    // Hard fallback — if nothing responds in 3s, assume offline
    setTimeout(() => done(false), 3000);
  });
});


// ── Persistent User Preferences ─────────────────────────────
const PREFS_FILE = path.join(app.getPath('userData'), 'KHALLYBEST_prefs.json');

function loadPrefs() {
  try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')); }
  catch { return {}; }
}

ipcMain.handle('get-prefs', () => loadPrefs());

ipcMain.handle('set-prefs', (event, data) => {
  const merged = { ...loadPrefs(), ...data };
  fs.writeFileSync(PREFS_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
});

// ── Secure HTTP/HTTPS Proxy ───────────────────────────────────
// Runs in Node — no CORS, no cookie warnings, no webSecurity needed
ipcMain.handle('net-fetch', async (event, url, options = {}) => {
  return new Promise((resolve) => {
    try {
      const urlObj   = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      const reqOpts  = {
        hostname: urlObj.hostname,
        port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path:     urlObj.pathname + urlObj.search,
        method:   options.method || 'GET',
        headers:  options.headers || {},
      };
      const req = protocol.request(reqOpts, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: body }));
      });
      req.on('error', err => resolve({ ok: false, status: 0, error: err.message, text: '' }));
      if (options.body) req.write(options.body);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, error: err.message, text: '' });
    }
  });
});

// ── Window Controls ───────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// ── System Info ───────────────────────────────────────────
ipcMain.handle('get-system-info', async () => {
  return {
    platform:  process.platform,
    hostname:  os.hostname(),
    username:  os.userInfo().username,
    homedir:   os.homedir(),
    cpus:      os.cpus().length,
    totalMem:  (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + ' GB',
    freeMem:   (os.freemem()  / 1024 / 1024 / 1024).toFixed(1) + ' GB',
    uptime:    Math.floor(os.uptime() / 3600) + 'h ' + Math.floor((os.uptime() % 3600) / 60) + 'm',
    arch:      os.arch(),
    nodeVer:   process.version,
  };
});

// ── List Directory ────────────────────────────────────────
ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    const target = dirPath || os.homedir();
    const entries = fs.readdirSync(target, { withFileTypes: true });
    return {
      path: target,
      items: entries.map(e => ({
        name:  e.name,
        isDir: e.isDirectory(),
        isFile: e.isFile(),
        ext:   path.extname(e.name).toLowerCase(),
      })).sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name))
    };
  } catch (err) {
    return { error: err.message, path: dirPath, items: [] };
  }
});

// ── Read File ─────────────────────────────────────────────
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 5 * 1024 * 1024) return { error: 'File too large (>5MB). Read aborted.' };
    const content = fs.readFileSync(filePath, 'utf8');
    return { content, path: filePath, size: stats.size };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Write File ────────────────────────────────────────────
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, path: filePath };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Browse Dialog ─────────────────────────────────────────
ipcMain.handle('browse-dialog', async (event, type) => {
  const props = type === 'dir'
    ? ['openDirectory']
    : ['openFile', 'multiSelections'];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: props,
    title: 'KHALLYBEST — Select Path',
  });
  return result.canceled ? null : result.filePaths;
});

// ── Run Shell Command ─────────────────────────────────────
ipcMain.handle('run-command', async (event, cmd, cwd) => {
  return new Promise(resolve => {
    const options = { cwd: cwd || os.homedir(), timeout: 15000, maxBuffer: 1024 * 512 };
    exec(cmd, options, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        error:  err ? err.message : null,
        code:   err ? err.code : 0,
      });
    });
  });
});

// ── Open App / URL / File ─────────────────────────────────
ipcMain.handle('open-item', async (event, target) => {
  try {
    await shell.openPath(target);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('open-url', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// ── Launch App by Name ────────────────────────────────────
ipcMain.handle('launch-app', async (event, appName) => {
  const APPS = {
    notepad:       'notepad.exe',
    calculator:    'calc.exe',
    paint:         'mspaint.exe',
    explorer:      'explorer.exe',
    chrome:        'start chrome',
    firefox:       'start firefox',
    edge:          'start msedge',
    vscode:        'code .',
    cmd:           'start cmd',
    powershell:    'start powershell',
    task_manager:  'taskmgr.exe',
    settings:      'ms-settings:',
    word:          'start winword',
    excel:         'start excel',
    outlook:       'start outlook',
    spotify:       'start spotify',
    whatsapp:      'start whatsapp',
  };
  const name = appName.toLowerCase().replace(/\s/g, '_');
  const cmd  = APPS[name] || `start ${appName}`;
  return new Promise(resolve => {
    exec(cmd, err => {
      resolve(err ? { error: err.message } : { success: true });
    });
  });
});

// ── ADB / Phone Operations ────────────────────────────────
ipcMain.handle('adb-command', async (event, adbCmd) => {
  return new Promise(resolve => {
    exec(`adb ${adbCmd}`, { timeout: 20000 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        error:  err ? err.message : null,
      });
    });
  });
});

ipcMain.handle('check-phone', async () => {
  return new Promise(resolve => {
    exec('adb devices', (err, stdout) => {
      if (err) {
        resolve({ connected: false, error: 'ADB not found. Install Android SDK Platform Tools.', devices: [] });
        return;
      }
      const lines   = stdout.split('\n').slice(1).filter(l => l.trim() && !l.includes('offline'));
      const devices = lines.map(l => l.split('\t')[0].trim()).filter(Boolean);
      resolve({ connected: devices.length > 0, devices });
    });
  });
});

ipcMain.handle('phone-list-files', async (event, remotePath) => {
  const dir = remotePath || '/sdcard/';
  return new Promise(resolve => {
    exec(`adb shell ls -la "${dir}"`, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) { resolve({ error: err.message, items: [] }); return; }
      const items = stdout.split('\n')
        .filter(l => l.trim() && !l.startsWith('total'))
        .map(l => {
          const parts = l.trim().split(/\s+/);
          const name  = parts.slice(7).join(' ');
          return { name, isDir: l.startsWith('d'), permissions: parts[0], size: parts[4] };
        }).filter(i => i.name && i.name !== '.' && i.name !== '..');
      resolve({ path: dir, items });
    });
  });
});

ipcMain.handle('phone-pull-file', async (event, remotePath, localDir) => {
  const dest = localDir || path.join(os.homedir(), 'Downloads');
  return new Promise(resolve => {
    exec(`adb pull "${remotePath}" "${dest}"`, { timeout: 60000 }, (err, stdout) => {
      resolve(err ? { error: err.message } : { success: true, dest });
    });
  });
});

ipcMain.handle('phone-push-file', async (event, localPath, remotePath) => {
  return new Promise(resolve => {
    exec(`adb push "${localPath}" "${remotePath}"`, { timeout: 60000 }, (err, stdout) => {
      resolve(err ? { error: err.message } : { success: true });
    });
  });
});

// ── Auto-Start Toggle ────────────────────────────────────
ipcMain.handle('set-auto-start', async (event, enable) => {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: enable, name: 'KHALLYBEST' });
    return { success: true, enabled: enable };
  }
  return { success: false, error: 'Not supported on this platform' };
});

ipcMain.handle('get-auto-start', async () => {
  if (process.platform === 'win32') {
    const settings = app.getLoginItemSettings();
    return { enabled: settings.openAtLogin };
  }
  return { enabled: false };
});

ipcMain.handle('phone-screenshot', async () => {
  const dest = path.join(os.homedir(), 'Desktop', `phone_screenshot_${Date.now()}.png`);
  return new Promise(resolve => {
    exec(`adb exec-out screencap -p > "${dest}"`, { timeout: 15000 }, (err) => {
      resolve(err ? { error: err.message } : { success: true, path: dest });
    });
  });
});
