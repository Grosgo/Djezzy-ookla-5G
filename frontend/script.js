// ==========================
// Gauge & Stats Configuration
// ==========================
const maxSpeed = 2000; // Mbps scale upper bound
const tickCount = 11;
const startAngle = 225;
const endAngle = 495;
const totalAngle = endAngle - startAngle;

const gaugeSize = 500;
const centerX = gaugeSize / 2;
const centerY = gaugeSize / 2;
const radius = 200;

// Cache DOM elements (ensure these exist in your HTML)
const startButton = document.getElementById("startButton");
const needle = document.querySelector(".needle");
const avgElem = document.getElementById("avgValue");
const peakElem = document.getElementById("peakValue");
const lowElem = document.getElementById("lowValue");
const phaseElem = document.getElementById("phaseValue"); // optional label in UI

// Build numeric scale around the gauge
(function buildGaugeScale() {
  const container = document.querySelector(".gauge-container");
  if (!container) return;
  const scaleContainer = document.createElement("div");
  scaleContainer.className = "gauge-scale";
  container.appendChild(scaleContainer);
  scaleContainer.innerHTML = "";

  for (let i = 0; i < tickCount; i++) {
    const mbps = i * (maxSpeed / (tickCount - 1));
    const angleDeg = startAngle + (mbps / maxSpeed) * totalAngle;
    const rad = (angleDeg - 90) * (Math.PI / 180);
    const x = centerX + radius * Math.cos(rad);
    const y = centerY + radius * Math.sin(rad);

    const tick = document.createElement("div");
    tick.className = "tick";
    tick.textContent = `${mbps.toFixed(0)}`;
    tick.style.position = "absolute";
    tick.style.left = `${(x / gaugeSize) * 100}%`;
    tick.style.top = `${(y / gaugeSize) * 100}%`;
    tick.style.transform = "translate(-50%, -50%)";
    scaleContainer.appendChild(tick);
  }
})();

// ==========================
// Gauge helpers
// ==========================
function speedToAngle(speed) {
  const clamped = Math.max(0, Math.min(speed, maxSpeed));
  return startAngle + (clamped / maxSpeed) * totalAngle;
}

function setNeedle(speed) {
  if (!needle) return;
  const clamped = Math.min(Math.max(speed, 0), maxSpeed);
  const angle = speedToAngle(clamped);
  needle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
}

function updateSpeed(speed) {
  setNeedle(speed);
  if (startButton) startButton.textContent = `${Math.max(0, speed).toFixed(0)} Mbps`;
}

function setPhaseLabel(txt) {
  if (phaseElem) phaseElem.textContent = txt || '';
}

// ==========================
// Live test via Server-Sent Events (/live)
// ==========================
let es = null;               // current EventSource
let count = 0;               // number of samples
let avg = 0;                 // running average
let peak = 0;
let low = Infinity;

function resetStats() {
  count = 0;
  avg = 0;
  peak = 0;
  low = Infinity;
  updateStatsUI();
}

function updateRunningStats(value) {
  // Welford-style simple running average (no extra arrays)
  count += 1;
  avg += (value - avg) / count;
  if (value > peak) peak = value;
  if (value < low)  low = value;
}

function formatMbps(x) {
  return Number.isFinite(x) ? `${x.toFixed(1)} Mbps` : "—";
}

function updateStatsUI() {
  if (avgElem)  avgElem.textContent  = formatMbps(count ? avg : 0);
  if (peakElem) peakElem.textContent = formatMbps(peak);
  if (lowElem)  lowElem.textContent  = formatMbps(low === Infinity ? 0 : low);
}

function cleanupStream(btnLabel) {
  if (es) { es.close(); es = null; }
  if (startButton) {
    startButton.disabled = false;
    startButton.textContent = btnLabel || "Test the Future!";
  }
}

function runSpeedTestLive() {
  if (es) { es.close(); es = null; }
  resetStats();
  setPhaseLabel('');

  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Running…";
  }

  // If your frontend is on another origin, use absolute URL:
  // es = new EventSource('http://localhost:8080/live');
  es = new EventSource("/live");

  es.onmessage = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }

    if (msg.type === "start") {
      // Optional: display selected server in UI
      // setPhaseLabel(`Server: ${msg.server?.name ?? msg.serverId ?? ''}`);
      return;
    }

    if (msg.type === "progress") {
      // We may get phases: 'download', 'upload', or 'ping'
      if (msg.phase) setPhaseLabel(msg.phase);

      if (typeof msg.mbps === 'number') {
        const mbps = Math.max(0, msg.mbps);
        updateRunningStats(mbps);
        updateSpeed(mbps);   // move needle + button label live
        updateStatsUI();     // update rolling avg/peak/low live
      }
      return;
    }

    if (msg.type === "final") {
      // Fold final values into stats in case they’re higher/lower
      if (Number.isFinite(msg.downMbps)) updateRunningStats(Math.max(0, msg.downMbps));
      if (Number.isFinite(msg.upMbps))   updateRunningStats(Math.max(0, msg.upMbps));
      updateStatsUI();
      cleanupStream("Test the Future!");
      setPhaseLabel('');
      return;
    }

    if (msg.type === "error" || msg.type === "aborted") {
      console.error("Live test error/aborted:", msg);
      cleanupStream("Retry Test");
      setPhaseLabel('');
      return;
    }
  };

  es.onerror = (e) => {
    console.error("SSE connection error", e);
    cleanupStream("Retry Test");
    setPhaseLabel('');
  };
}

// ==========================
// Initial State & Events
// ==========================
window.addEventListener("load", () => {
  setNeedle(0);
  updateStatsUI();
});

if (startButton) {
  startButton.addEventListener("click", runSpeedTestLive);
}
