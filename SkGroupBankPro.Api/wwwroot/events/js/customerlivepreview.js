(() => {
  const API_GET_PATH = "/api/events/live-state";
  const HUB_PATH = "/hubs/liveevents";
  const $ = (id) => document.getElementById(id);

  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = (v == null || v === "") ? "—" : String(v);
  }

  function absUrl(path) {
    const base = (window.API_BASE || "").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  // ---------- labels inside wheel ----------
  function injectWheelLabelCssOnce() {
    if (document.getElementById("wheelLabelCss")) return;

    const style = document.createElement("style");
    style.id = "wheelLabelCss";
    style.textContent = `
      #wheel { position: relative; }
      #wheel .wheelLabels { position:absolute; inset:0; pointer-events:none; }
      #wheel .wheelLabel{
        position:absolute;
        left:50%; top:50%;
        transform-origin: 0 0;
        font-weight: 800;
        font-size: 14px;
        color: rgba(255,255,255,.92);
        text-shadow: 0 2px 10px rgba(0,0,0,.85);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLabelsLayer() {
    const wheel = $("wheel");
    if (!wheel) return null;

    let layer = wheel.querySelector(".wheelLabels");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "wheelLabels";
      wheel.appendChild(layer);
    }
    return layer;
  }

  function renderCustomers(customers) {
    const wheel = $("wheel");
    if (!wheel) return;

    injectWheelLabelCssOnce();
    const layer = ensureLabelsLayer();
    if (!layer) return;

    layer.innerHTML = "";

    const names = Array.isArray(customers) ? customers.map(x => String(x || "").trim()).filter(Boolean) : [];
    const n = names.length;
    if (!n) return;

    const radius = 155;

    for (let i = 0; i < n; i++) {
      const angle = (360 / n) * i;
      const el = document.createElement("div");
      el.className = "wheelLabel";
      el.style.transform = `rotate(${angle}deg) translate(${radius}px, -10px) rotate(90deg)`;
      el.textContent = names[i];
      layer.appendChild(el);
    }
  }

  function spinToWinner(customers, winnerName, spinMs, extraTurns) {
    const wheel = $("wheel");
    if (!wheel) return;

    const names = Array.isArray(customers) ? customers.map(x => String(x || "").trim()).filter(Boolean) : [];
    const n = names.length;
    if (!n || !winnerName) return;

    const norm = (s) => String(s || "").trim().toLowerCase();
    const idx = names.findIndex(x => norm(x) === norm(winnerName));
    if (idx < 0) return;

    const seg = 360 / n;
    const target = 360 - (idx * seg + seg / 2);

    const current = wheel.dataset.rot ? Number(wheel.dataset.rot) : 0;
    const turns = Math.max(3, Number(extraTurns || 6));

    const baseTurns = (Math.floor(current / 360) + turns) * 360;
    const nextRot = baseTurns + target;

    wheel.dataset.rot = String(nextRot);
    wheel.style.transition = `transform ${spinMs}ms cubic-bezier(0.10, 0.80, 0.10, 1)`;
    wheel.style.transform = `rotate(${nextRot}deg)`;
  }

  let lastSpinToken = null;

  function applyState(state) {
    state = state || {};

    setText("livePrize", state.winningPrize || "—");
    setText("liveWinner", state.winnerName || "—");
    renderCustomers(state.customers || []);

    if (state.spinNow && state.spinToken && state.spinToken !== lastSpinToken) {
      lastSpinToken = state.spinToken;
      const ms = Math.max(1000, Number(state.spinMs || 5000));
      const turns = Math.max(3, Number(state.minRot || 6));
      spinToWinner(state.customers || [], state.winnerName || "", ms, turns);
    }
  }

  async function fetchStateOnce() {
    // Use apiFetch if present, otherwise raw fetch
    if (typeof window.apiFetch === "function") {
      const data = await window.apiFetch(API_GET_PATH, { cache: "no-store" });
      return (data && data.state) ? data.state : {};
    }

    const res = await fetch(absUrl(API_GET_PATH), { cache: "no-store" });
    if (!res.ok) throw new Error(`Load failed (${res.status})`);
    const data = await res.json();
    return data.state || {};
  }

  async function startSignalR() {
    if (!window.signalR) return false;

    const hubUrl = absUrl(HUB_PATH);

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl) // anonymous is OK
      .withAutomaticReconnect()
      .build();

    conn.on("liveStateUpdated", (state) => applyState(state || {}));

    try {
      await conn.start();
      return true;
    } catch {
      return false;
    }
  }

  function startPollingFallback() {
    setInterval(async () => {
      try {
        const s = await fetchStateOnce();
        applyState(s);
      } catch { }
    }, 1200);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const s = await fetchStateOnce();
      applyState(s);
    } catch { }

    const ok = await startSignalR();
    if (!ok) startPollingFallback();
  });

  window.toggleFullscreen = function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
})();
