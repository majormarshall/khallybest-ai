# KHALLYBEST Desktop — AI Assistant

> A powerful, Jarvis-inspired AI desktop assistant built with Electron.js and Google Gemini AI.

![KHALLYBEST](https://img.shields.io/badge/AI-Gemini%202.0-blue) ![Electron](https://img.shields.io/badge/Electron-v31-cyan) ![Platform](https://img.shields.io/badge/Platform-Windows-green)

## Features

- 🗣️ **Voice Control** — Speak naturally, KHALLYBEST listens and responds
- 💬 **AI Chat** — Full Gemini 2.0 Flash powered conversation with memory
- 📁 **File System** — Browse, read, and analyze any file on your PC
- ⚡ **Terminal** — Run PowerShell commands directly
- 📱 **Phone Manager** — Browse & control Android phone via ADB
- 🧑‍💻 **Code Analyzer** — Debug, optimize, and explain code in any language
- 🚀 **App Launcher** — Open any application instantly
- 🌍 **Multi-language** — English, Hausa, Yoruba, Igbo
- ⏰ **Reminders** — Set timed alerts
- 📰 **News & Weather** — Live data from public APIs
- 💰 **Stocks & Crypto** — Real-time price lookups

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/KHALLYBEST-desktop.git
cd KHALLYBEST-desktop
```

### 2. Install dependencies
```bash
npm install
```

### 3. Add your Gemini API Key
Open `renderer/config.js` and replace the key:
```js
GEMINI_API_KEY: "YOUR_KEY_HERE",
```
Get a free key at: https://aistudio.google.com/app/apikey

### 4. Launch
```bash
npm start
```
Or double-click **`Launch KHALLYBEST.bat`**

## Phone Manager (ADB)
Requires Android SDK Platform Tools installed and in PATH.
- Download: https://developer.android.com/studio/releases/platform-tools
- Enable USB Debugging on your Android phone
- Connect via USB → Click "Detect Phone" in KHALLYBEST

## Tech Stack
- **Electron** — Desktop runtime
- **Google Gemini 2.0 Flash** — AI brain
- **Node.js** — System access (fs, shell, http)
- **Web Speech API** — Voice recognition
- **ADB** — Android phone control

---
*Built with ❤️ by a visionary developer.*
