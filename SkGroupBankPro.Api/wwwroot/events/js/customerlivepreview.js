(() => {
  const POLL_MS = 800;
  const $ = (id) => document.getElementById(id);

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = (value == null || value === "") ? "—" : String(value);
  }

  function spinWheel(ms, minRot) {
    const wheel = $("wheel");
    if (!wheel) return;

    const extra = Math.floor(Math.random() * 360);
    const turns = Math.max(3, Number(minRot || 5));
    const deg = (turns * 360) + extra;

    const current = wheel.dataset.rot ? Number(wheel.dataset.rot) : 0;
    const nextRot = current + deg;
    wheel.dataset.rot = String(nextRot);

    wheel.style.transition = `transform ${ms}ms cubic-bezier(0.10, 0.80, 0.10, 1)`;
    wheel.style.transform = `rotate(${nextRot}deg)`;
  }

  // ✅ IMPORTANT: staff page sends spinToken, not actionToken
  let lastSpinToken = null;

  function applyState(s) {
    s = s || {};

    // Always update text
    setText("livePrize", s.winningPrize || "—");
    setText("liveWinner", s.winnerName || "—");

    // Optional: hide result box until revealWinner true
    // const box = document.querySelector(".resultWrap");
    // if (box) box.style.opacity = s.revealWinner ? "1" : "0";

    // Spin only when spinToken changes
    if (s.spinNow && s.spinToken && s.spinToken !== lastSpinToken) {
      lastSpinToken = s.spinToken;

      const ms = Math.max(1000, Number(s.spinMs || 5000));
      const minRot = Math.max(3, Number(s.minRot || 5));

      spinWheel(ms, minRot);
    }
  }

  async function fetchState() {
    // apiFetch comes from /js/api.js loaded in HTML
    const data = await apiFetch("/api/events/live-state", { cache: "no-store" });
    return (data && data.state) ? data.state : {};
  }

  async function pollLoop() {
    try {
      const s = await fetchState();
      applyState(s);
    } catch {
      // ignore; SignalR will handle if available
    }
    setTimeout(pollLoop, POLL_MS);
  }

  async function startSignalR() {
    if (!window.signalR || !window.API_BASE) return false;

    const hubUrl = `${window.API_BASE}/hubs/liveevents`;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    conn.on("liveStateUpdated", (state) => {
      applyState(state);
    });

    try {
      await conn.start();
      return true;
    } catch {
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Always poll (fallback)
    pollLoop();

    // Try realtime
    await startSignalR();
  });

  // Used by your HTML buttons
  window.toggleFullscreen = function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };
})();
