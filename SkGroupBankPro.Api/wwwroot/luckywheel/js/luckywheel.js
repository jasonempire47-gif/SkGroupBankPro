(() => {
  const $ = (id) => document.getElementById(id);

  const LS = {
    NAMES: "casino_wheel_names_v1",
    PRIZES: "casino_wheel_prizes_v1",
    HIST: "casino_wheel_history_v1"
  };

  // Canvas + animation
  const canvas = $("wheelCanvas");
  const ctx = canvas.getContext("2d");

  // UI
  const namesBox = $("namesBox");
  const prizesBox = $("prizesBox");
  const historyList = $("historyList");

  const btnSpin = $("btnSpin");
  const btnReset = $("btnReset");
  const btnExport = $("btnExport");
  const btnClearHistory = $("btnClearHistory");

  const btnShuffleNames = $("btnShuffleNames");
  const btnClearNames = $("btnClearNames");
  const btnLoadSample = $("btnLoadSample");
  const btnClearPrizes = $("btnClearPrizes");

  const liveWinner = $("liveWinner");
  const livePrize = $("livePrize");

  const spinSeconds = $("spinSeconds");
  const minTurns = $("minTurns");
  const winnerMode = $("winnerMode");
  const prizeMode = $("prizeMode");

  // State
  let spinning = false;
  let angle = 0; // radians
  let targetAngle = 0;
  let startAngle = 0;
  let startTime = 0;
  let durationMs = 6000;

  // ----- Helpers -----
  function nowISO() {
    const d = new Date();
    return d.toISOString();
  }

  function safeLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function saveLS(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
  function loadLS(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fitCanvasToCSSSize() {
    // keep crisp on retina
    const cssSize = canvas.getBoundingClientRect().width;
    const dpr = window.devicePixelRatio || 1;

    const px = Math.max(320, Math.floor(cssSize * dpr));
    canvas.width = px;
    canvas.height = px;

    drawWheel();
  }

  // ----- Wheel drawing -----
  function goldStroke(width) {
    ctx.lineWidth = width;
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "rgba(247,216,144,0.95)");
    g.addColorStop(0.5, "rgba(215,177,92,0.95)");
    g.addColorStop(1, "rgba(123,90,24,0.95)");
    ctx.strokeStyle = g;
  }

  function drawWheel() {
    const prizes = safeLines(prizesBox.value);
    const n = Math.max(2, prizes.length || 0);

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) * 0.92;

    // clear
    ctx.clearRect(0, 0, w, h);

    // base shadow ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // outer halo
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();

    // segments
    const seg = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const a0 = i * seg;
      const a1 = a0 + seg;

      // alternate dark tones with gold tint
      const isAlt = i % 2 === 0;
      const fill = isAlt
        ? "rgba(10,10,10,0.86)"
        : "rgba(25,20,10,0.82)";

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      // thin separator line
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.strokeStyle = "rgba(247,216,144,0.14)";
      ctx.lineWidth = Math.max(1, w * 0.002);
      ctx.stroke();

      // label
      const label = prizes[i] || `Prize ${i + 1}`;
      const mid = a0 + seg / 2;

      ctx.save();
      ctx.rotate(mid);
      ctx.translate(r * 0.62, 0);

      // text
      const fontSize = Math.max(14, Math.floor(w * 0.03));
      ctx.font = `900 ${fontSize}px system-ui, Segoe UI, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // gold text
      ctx.fillStyle = "rgba(247,216,144,0.95)";
      // subtle shadow
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = Math.max(2, w * 0.01);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(1, w * 0.005);

      // truncate
      const maxLen = 16;
      const t = label.length > maxLen ? label.slice(0, maxLen - 1) + "…" : label;

      // rotate text upright-ish
      ctx.rotate(Math.PI / 2);
      ctx.fillText(t, 0, 0);

      ctx.restore();
    }

    // inner ring
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();

    // outer gold strokes
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    goldStroke(Math.max(3, w * 0.012));
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    goldStroke(Math.max(1.5, w * 0.006));
    ctx.stroke();

    ctx.restore();

    // decorative center badge
    ctx.save();
    ctx.translate(cx, cy);

    const badgeR = r * 0.22;
    const grad = ctx.createRadialGradient(0, 0, badgeR * 0.2, 0, 0, badgeR);
    grad.addColorStop(0, "rgba(255,255,255,0.22)");
    grad.addColorStop(0.35, "rgba(247,216,144,0.95)");
    grad.addColorStop(1, "rgba(123,90,24,0.95)");
    ctx.beginPath();
    ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, badgeR * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    ctx.font = `1000 ${Math.max(16, Math.floor(w * 0.04))}px system-ui, Segoe UI, Arial`;
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MG", 0, -Math.max(2, w * 0.005));

    ctx.font = `800 ${Math.max(10, Math.floor(w * 0.018))}px system-ui, Segoe UI, Arial`;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillText("EVENTS", 0, Math.max(20, w * 0.025));

    ctx.restore();
  }

  function currentPrizeIndex() {
    const prizes = safeLines(prizesBox.value);
    const n = Math.max(2, prizes.length || 0);
    const seg = (Math.PI * 2) / n;

    // pointer is at top ( -90deg ), we need wheel angle offset
    // When angle increases, wheel rotates clockwise visually due to canvas rotation.
    // Convert: pointer angle in wheel-space:
    let a = (Math.PI * 1.5 - angle) % (Math.PI * 2); // 270deg - angle
    if (a < 0) a += Math.PI * 2;
    const idx = Math.floor(a / seg) % n;
    return idx;
  }

  // ----- History -----
  function renderHistory() {
    const hist = loadLS(LS.HIST, []);
    historyList.innerHTML = "";

    if (!hist.length) {
      historyList.innerHTML = `<div class="histItem" style="opacity:.7">No winners yet.</div>`;
      return;
    }

    for (const row of hist) {
      const div = document.createElement("div");
      div.className = "histItem";
      const d = new Date(row.time);
      div.innerHTML = `
        <div class="histTop">
          <div class="histWinner">${escapeHtml(row.winner)}</div>
          <div class="histTime">${escapeHtml(d.toLocaleString())}</div>
        </div>
        <div class="histPrize">${escapeHtml(row.prize)}</div>
      `;
      historyList.appendChild(div);
    }
  }

  function addHistory(winner, prize) {
    const hist = loadLS(LS.HIST, []);
    hist.unshift({ winner, prize, time: nowISO() });
    saveLS(LS.HIST, hist.slice(0, 30));
    renderHistory();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ----- Spin logic -----
  function pickWinnerName() {
    const names = safeLines(namesBox.value);
    if (!names.length) return null;

    const idx = Math.floor(Math.random() * names.length);
    const winner = names[idx];

    if (winnerMode.value === "remove") {
      names.splice(idx, 1);
      namesBox.value = names.join("\n");
      saveLS(LS.NAMES, names);
    }
    return winner;
  }

  function pickPrize() {
    const prizes = safeLines(prizesBox.value);
    if (!prizes.length) return "—";

    if (prizeMode.value === "random") {
      return prizes[Math.floor(Math.random() * prizes.length)];
    }

    // wheel-based: determined by stop angle
    const idx = currentPrizeIndex();
    return prizes[idx] || `Prize ${idx + 1}`;
  }

  function spinToIndex(index) {
    const prizes = safeLines(prizesBox.value);
    const n = Math.max(2, prizes.length || 0);
    const seg = (Math.PI * 2) / n;

    // We want pointer at top to land on `index`.
    // Solve for angle such that currentPrizeIndex() == index.
    // currentPrizeIndex uses a = 1.5π - angle; idx=floor(a/seg)
    // Choose a target within that segment: (index + 0.5)*seg
    const aMid = (index + 0.5) * seg;
    let desiredAngle = (Math.PI * 1.5 - aMid);

    // normalize
    desiredAngle = ((desiredAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);

    // add full turns
    const turns = Math.max(3, Number(minTurns.value || 7));
    const extra = turns * Math.PI * 2;

    // Make sure we rotate forward from current angle
    // We'll set targetAngle > angle
    const current = angle % (Math.PI * 2);
    const deltaBase = ((desiredAngle - current) + (Math.PI * 2)) % (Math.PI * 2);

    targetAngle = angle + extra + deltaBase;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateSpin(ts) {
    if (!spinning) return;

    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const t = Math.min(1, elapsed / durationMs);
    const e = easeOutCubic(t);

    angle = startAngle + (targetAngle - startAngle) * e;
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(animateSpin);
    } else {
      spinning = false;
      btnSpin.disabled = false;

      const winner = pickWinnerName() ?? "—";
      const prize = pickPrize();

      liveWinner.textContent = winner;
      livePrize.textContent = prize;

      addHistory(winner, prize);
      saveAllToLS();
    }
  }

  function startSpin() {
    if (spinning) return;

    const prizes = safeLines(prizesBox.value);
    if (prizes.length < 2) {
      alert("Please enter at least 2 prizes.");
      return;
    }

    const names = safeLines(namesBox.value);
    if (!names.length) {
      alert("Please enter at least 1 customer name.");
      return;
    }

    spinning = true;
    btnSpin.disabled = true;

    durationMs = Math.max(2000, Math.min(20000, Number(spinSeconds.value || 6) * 1000));

    // Choose a wheel index if prizeMode is wheel.
    // If prizeMode is random, we still spin visually to a random segment.
    const n = prizes.length;
    const idx = Math.floor(Math.random() * n);
    spinToIndex(idx);

    startAngle = angle;
    startTime = 0;
    requestAnimationFrame(animateSpin);
  }

  // ----- Persistence -----
  function saveAllToLS() {
    saveLS(LS.NAMES, safeLines(namesBox.value));
    saveLS(LS.PRIZES, safeLines(prizesBox.value));
  }

  function restoreFromLS() {
    const names = loadLS(LS.NAMES, []);
    const prizes = loadLS(LS.PRIZES, []);

    if (names.length) namesBox.value = names.join("\n");
    if (prizes.length) prizesBox.value = prizes.join("\n");

    renderHistory();
  }

  // ----- Events -----
  btnSpin.addEventListener("click", startSpin);

  btnReset.addEventListener("click", () => {
    if (spinning) return;
    angle = 0;
    liveWinner.textContent = "—";
    livePrize.textContent = "—";
    drawWheel();
  });

  btnShuffleNames.addEventListener("click", () => {
    const arr = safeLines(namesBox.value);
    shuffle(arr);
    namesBox.value = arr.join("\n");
    saveAllToLS();
  });

  btnClearNames.addEventListener("click", () => {
    namesBox.value = "";
    saveAllToLS();
  });

  btnLoadSample.addEventListener("click", () => {
    prizesBox.value = [
      "Free Spin x10",
      "$5 Bonus",
      "$10 Bonus",
      "VIP Upgrade",
      "Mystery Box",
      "Cashback 5%",
      "Free Bet",
      "Try Again"
    ].join("\n");
    drawWheel();
    saveAllToLS();
  });

  btnClearPrizes.addEventListener("click", () => {
    prizesBox.value = "";
    drawWheel();
    saveAllToLS();
  });

  btnClearHistory.addEventListener("click", () => {
    if (!confirm("Clear winner history?")) return;
    localStorage.removeItem(LS.HIST);
    renderHistory();
  });

  btnExport.addEventListener("click", () => {
    const hist = loadLS(LS.HIST, []);
    if (!hist.length) return alert("No winners to export yet.");

    const csv = [
      ["time", "winner", "prize"].join(","),
      ...hist.map(r => [r.time, `"${String(r.winner).replaceAll('"','""')}"`, `"${String(r.prize).replaceAll('"','""')}"`].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "winners.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  // live redraw + save
  let saveTmr = null;
  function debouncedSaveAndDraw() {
    if (saveTmr) clearTimeout(saveTmr);
    saveTmr = setTimeout(() => {
      saveAllToLS();
      drawWheel();
    }, 200);
  }
  prizesBox.addEventListener("input", debouncedSaveAndDraw);
  namesBox.addEventListener("input", () => {
    if (saveTmr) clearTimeout(saveTmr);
    saveTmr = setTimeout(saveAllToLS, 200);
  });

  window.addEventListener("resize", fitCanvasToCSSSize);

  // init
  restoreFromLS();
  fitCanvasToCSSSize();
})();
