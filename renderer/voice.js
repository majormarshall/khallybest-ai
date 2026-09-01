// ============================================================
//  KHALLYBEST — Voice Biometrics Module v1.0
//  Enroll your voice, use it to wake up KHALLYBEST
//  Works in both Web and Desktop (Electron) versions
// ============================================================

const VoiceBiometrics = (() => {

  const STORAGE_KEY   = 'kb_voice_print';
  const ENROLL_REPS   = 3;         // samples to record during enrollment
  const SAMPLE_MS     = 2500;      // ms per sample
  const FFT_SIZE      = 1024;
  const THRESHOLD     = 0.82;      // cosine similarity threshold (0-1)

  let enrolled = false;

  // ── Utility: cosine similarity ──────────────────────────────
  function cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-8);
  }

  // ── Extract frequency fingerprint from a stream ─────────────
  async function extractFingerprint(stream, durationMs = SAMPLE_MS) {
    return new Promise(resolve => {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);

      const bins    = analyser.frequencyBinCount;
      const snapshots = [];
      const interval = setInterval(() => {
        const data = new Float32Array(bins);
        analyser.getFloatFrequencyData(data);
        snapshots.push(Array.from(data));
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        ctx.close();
        // Average all snapshots → single fingerprint vector
        const avg = new Array(bins).fill(0);
        snapshots.forEach(s => s.forEach((v, i) => { avg[i] += v; }));
        avg.forEach((_, i) => { avg[i] /= snapshots.length; });
        resolve(avg);
      }, durationMs);
    });
  }

  // ── Get microphone stream ────────────────────────────────────
  async function getMicStream() {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  // ── Enrollment ──────────────────────────────────────────────
  async function enroll(onProgress) {
    const prints = [];
    for (let i = 0; i < ENROLL_REPS; i++) {
      onProgress?.(`🎙️ Recording sample ${i + 1} of ${ENROLL_REPS}… speak now!`);
      await new Promise(r => setTimeout(r, 600)); // brief pause before recording
      let stream;
      try {
        stream = await getMicStream();
        const fp = await extractFingerprint(stream, SAMPLE_MS);
        prints.push(fp);
        stream.getTracks().forEach(t => t.stop());
        onProgress?.(`✅ Sample ${i + 1} captured`);
        await new Promise(r => setTimeout(r, 400));
      } catch(e) {
        stream?.getTracks().forEach(t => t.stop());
        throw new Error('Microphone access denied: ' + e.message);
      }
    }
    // Average all enrollment prints → master fingerprint
    const bins   = prints[0].length;
    const master = new Array(bins).fill(0);
    prints.forEach(p => p.forEach((v, i) => { master[i] += v; }));
    master.forEach((_, i) => { master[i] /= prints.length; });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(master));
    enrolled = true;
    onProgress?.('🔒 Voice enrolled! KHALLYBEST will now recognize only your voice.');
    return true;
  }

  // ── Verification ─────────────────────────────────────────────
  async function verify() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true; // No enrollment → open access

    const stored = JSON.parse(raw);
    let stream;
    try {
      stream = await getMicStream();
      const candidate = await extractFingerprint(stream, 1500);
      stream.getTracks().forEach(t => t.stop());
      const sim = cosineSimilarity(candidate, stored);
      console.log('[VoiceBiometrics] similarity:', sim.toFixed(4));
      return sim >= THRESHOLD;
    } catch(e) {
      stream?.getTracks().forEach(t => t.stop());
      return true; // On error, allow through (fail-open)
    }
  }

  // ── Clear enrollment ─────────────────────────────────────────
  function clearEnrollment() {
    localStorage.removeItem(STORAGE_KEY);
    enrolled = false;
  }

  // ── Check if enrolled ────────────────────────────────────────
  function isEnrolled() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  return { enroll, verify, isEnrolled, clearEnrollment, THRESHOLD };
})();

// ─────────────────────────────────────────────────────────────
//  ENROLLMENT UI CONTROLLER
// ─────────────────────────────────────────────────────────────
async function startVoiceEnrollment() {
  const btn    = document.getElementById('enrollBtn');
  const status = document.getElementById('enrollStatus');
  const badge  = document.getElementById('enrollBadge');
  if (!btn || !status) return;

  btn.disabled = true;
  btn.textContent = '⏳ Enrolling…';

  try {
    await VoiceBiometrics.enroll(msg => {
      if (status) status.textContent = msg;
    });
    if (badge) { badge.textContent = '✅ Enrolled'; badge.className = 'enroll-badge enrolled'; }
    btn.textContent = '🔄 Re-Enroll';
    btn.disabled = false;
  } catch(e) {
    if (status) status.textContent = '❌ ' + e.message;
    btn.textContent = '🎙️ Enroll Voice';
    btn.disabled = false;
  }
}

function clearVoiceEnrollment() {
  VoiceBiometrics.clearEnrollment();
  const badge  = document.getElementById('enrollBadge');
  const status = document.getElementById('enrollStatus');
  const btn    = document.getElementById('enrollBtn');
  if (badge)  { badge.textContent = '⚪ Not Enrolled'; badge.className = 'enroll-badge'; }
  if (status) status.textContent = 'Voice data cleared. Enroll again to re-enable.';
  if (btn)    btn.textContent = '🎙️ Enroll Voice';
}

function updateEnrollBadge() {
  const badge = document.getElementById('enrollBadge');
  if (!badge) return;
  if (VoiceBiometrics.isEnrolled()) {
    badge.textContent = '✅ Enrolled';
    badge.className = 'enroll-badge enrolled';
  } else {
    badge.textContent = '⚪ Not Enrolled';
    badge.className = 'enroll-badge';
  }
}
