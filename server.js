// server.js — Express app with live SSE progress via Ookla JSONL + JSON endpoints 
const express = require('express');
const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
app.use(cors());
app.use(express.static(path.join(__dirname, 'frontend')));

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
// remove SIMULATE logic or ensure process.env.SIMULATE !== '1'
app.listen(PORT, () => console.log('listening on', PORT));
const LEGACY_PORT = parseInt(process.env.LEGACY_PORT || '3000', 10); // unused on Render
const SERVER_ID = process.env.SERVER_ID || 32700; // e.g., Djezzy Oran
const isWin = process.platform === 'win32';
const SPEEDTEST_BIN = isWin ? path.join(__dirname, 'speedtest.exe') : 'speedtest';
const FRONTEND_DIR = path.join(__dirname, 'frontend');

// Allow browser clients from other origins while testing (restrict later if needed)
app.use(cors());
app.use(express.static(FRONTEND_DIR));


app.get('/health', (_req, res) => res.json({ ok: true }));

// ---- One-shot JSON (final result) ----
// ---- One-shot JSON (final result) ----
function runSpeedtestJSON(res) {
  // Build the command string (shell form so we can pass flags)
  const cmd = `"${SPEEDTEST_BIN}" --accept-license --accept-gdpr -s ${SERVER_ID} -f json`;

  // Try exec — if the binary is missing exec will call the callback with an error.
  exec(cmd, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
    if (err) {
      // Helpful error for missing binary (ENOENT) or other failures
      if (err.code === 'ENOENT' || /not found|No such file|cannot find/i.test(err.message + (stderr || ''))) {
        return res.status(500).json({ error: 'speedtest binary not found on server. Deploy with the binary or use a Docker image that includes it.' });
      }
      return res.status(500).json({ error: err.message, stderr });
    }
    try {
      res.json(JSON.parse(stdout));
    } catch (parseErr) {
      res.status(500).json({ error: 'Parse error', parseError: parseErr.message, sample: stdout?.slice(0, 2000) || '' });
    }
  });
}

app.get('/api/speedtest', (req, res) => runSpeedtestJSON(res));
app.get('/speedtest', (req, res) => runSpeedtestJSON(res));

// ---- Live streaming via Server-Sent Events (JSONL from Ookla) ----
app.get('/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const args = ['--accept-license', '--accept-gdpr', '-s', String(SERVER_ID), '-f', 'jsonl'];
  // inside app.get('/live', ...) before spawn:
exec(`which ${SPEEDTEST_BIN}`, (whichErr) => {
  if (whichErr) {
    send({ type: 'error', message: 'speedtest binary not found on server. Live test unavailable.' });
    clearInterval(keepAlive);
    return res.end();
  }
  // proceed to spawn normally...
});

  const child = spawn(SPEEDTEST_BIN, args, { windowsHide: true });

  let stdoutBuf = '';
  let inUploadPhase = false;   // flag: stop storing progress once upload begins
  let lastDownloadMbps = null;
  let lastUploadMbps = null;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk;

    let idx;
    while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, idx).trim();
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (!line) continue;

      let obj;
      try { obj = JSON.parse(line); } catch { continue; }

      if (obj.type === 'download' && obj.download?.bandwidth != null && !inUploadPhase) {
        const mbps = (obj.download.bandwidth * 8) / 1e6;
        lastDownloadMbps = mbps;
        send({ type: 'progress', phase: 'download', mbps, t: Date.now() });
        continue;
      }

      if (obj.type === 'upload' && obj.upload?.bandwidth != null) {
        inUploadPhase = true; // once upload starts, stop sending progress updates
        lastUploadMbps = (obj.upload.bandwidth * 8) / 1e6;
        continue;
      }

      if (obj.type === 'result') {
        const downMbps = obj.download?.bandwidth ? (obj.download.bandwidth * 8) / 1e6 : lastDownloadMbps ?? null;
        const upMbps   = obj.upload?.bandwidth   ? (obj.upload.bandwidth   * 8) / 1e6 : lastUploadMbps   ?? null;
        send({ type: 'final', downMbps, upMbps, json: obj, t: Date.now() });
      }
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (s) => {
    // optionally log
  });

  const finish = () => {
    clearInterval(keepAlive);
    try { child.kill('SIGKILL'); } catch {}
    res.end();
  };

  child.on('close', finish);
  child.on('error', (e) => { send({ type: 'error', message: e.message }); finish(); });
  req.on('close', () => { send({ type: 'aborted' }); finish(); });

  send({ type: 'start', serverId: SERVER_ID, t: Date.now() });
});


// ---- Optional legacy JSON on separate port ----
// ---- Legacy JSON route (served on the same port for compatibility) ----
app.get('/legacy/speedtest', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return runSpeedtestJSON(res);
});

// Start single HTTP server (Render attaches public domain)
http.createServer(app).listen(PORT, () => {
  console.log(`Frontend    : http://localhost:${PORT}/`);
  console.log(`Live SSE    : http://localhost:${PORT}/live`);
  console.log(`JSON (new)  : http://localhost:${PORT}/api/speedtest`);
  console.log(`JSON (alias): http://localhost:${PORT}/speedtest`);
  console.log(`Legacy JSON : http://localhost:${PORT}/legacy/speedtest`);
});

