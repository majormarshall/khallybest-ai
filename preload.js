// ============================================================
//  KHALLYBEST — Preload Script
//  Safe bridge between Electron main process and renderer UI
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('KHALLYBEST', {

  // ── Window Controls ──────────────────────────────────────
  minimize:  () => ipcRenderer.send('window-minimize'),
  maximize:  () => ipcRenderer.send('window-maximize'),
  close:     () => ipcRenderer.send('window-close'),

  // ── System ───────────────────────────────────────────────
  getSystemInfo:  ()              => ipcRenderer.invoke('get-system-info'),
  runCommand:     (cmd, cwd)      => ipcRenderer.invoke('run-command', cmd, cwd),
  openItem:       (target)        => ipcRenderer.invoke('open-item', target),
  openUrl:        (url)           => ipcRenderer.invoke('open-url', url),
  launchApp:      (appName)       => ipcRenderer.invoke('launch-app', appName),

  // ── File System ──────────────────────────────────────────
  listDir:        (dirPath)       => ipcRenderer.invoke('list-directory', dirPath),
  readFile:       (filePath)      => ipcRenderer.invoke('read-file', filePath),
  writeFile:      (filePath, txt) => ipcRenderer.invoke('write-file', filePath, txt),
  browseDialog:   (type)          => ipcRenderer.invoke('browse-dialog', type),

  // ── Phone (ADB) ──────────────────────────────────────────
  checkPhone:       ()                    => ipcRenderer.invoke('check-phone'),
  adbCommand:       (cmd)                 => ipcRenderer.invoke('adb-command', cmd),
  phoneListFiles:   (path)                => ipcRenderer.invoke('phone-list-files', path),
  phonePullFile:    (remote, local)       => ipcRenderer.invoke('phone-pull-file', remote, local),
  phonePushFile:    (local, remote)       => ipcRenderer.invoke('phone-push-file', local, remote),
  phoneScreenshot:  ()                    => ipcRenderer.invoke('phone-screenshot'),

  // ── Voice (Offline) ──────────────────────────────────────
  offlineListen:    ()                    => ipcRenderer.invoke('offline-listen'),
  checkOnline:      ()                    => ipcRenderer.invoke('check-online'),

  // ── Secure Network Proxy (no CORS, no webSecurity needed) ─
  netFetch: (url, opts) => ipcRenderer.invoke('net-fetch', url, opts),

  // ── User Preferences (persisted to disk) ─────────────────
  getPrefs:      ()       => ipcRenderer.invoke('get-prefs'),
  setPrefs:      (data)   => ipcRenderer.invoke('set-prefs', data),

  // ── Auto-Start ───────────────────────────────────────────
  getAutoStart:  ()       => ipcRenderer.invoke('get-auto-start'),
  setAutoStart:  (enable) => ipcRenderer.invoke('set-auto-start', enable),
});
