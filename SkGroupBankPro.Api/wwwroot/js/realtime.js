// wwwroot/js/realtime.js
(function () {
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function normalizeBase(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  function getApiBase() {
    // ✅ Priority:
    // 1) localStorage override (optional)
    // 2) window.API_BASE from api.js (recommended)
    // 3) same-origin (if UI is served by the API)
    // 4) localhost fallback

    const ls = normalizeBase(localStorage.getItem("API_BASE"));
    if (ls) return ls;

    const wb = normalizeBase(window.API_BASE);
    if (wb) return wb;

    const origin = normalizeBase(location.origin);
    if (origin && origin !== "null") return origin;

    return "http://localhost:5000";
  }

  const callbacks = new Set();
  let connection = null;

  window.onDashboardUpdated = function onDashboardUpdated(cb) {
    if (typeof cb !== "function") return () => {};
    callbacks.add(cb);
    return () => callbacks.delete(cb);
  };

  window.startRealtime = async function startRealtime() {
    if (!window.signalR) {
      console.warn("[realtime] signalR client not loaded.");
      return;
    }
    if (connection) return;

    const base = getApiBase();

    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${base}/hubs/dashboard`, {
        accessTokenFactory: () => getToken()
      })
      .withAutomaticReconnect()
      .build();

    connection.on("DashboardUpdated", (payload) => {
      for (const cb of callbacks) {
        try { cb(payload); } catch (e) { console.error(e); }
      }
    });

    try {
      await connection.start();
      console.log("[realtime] connected:", `${base}/hubs/dashboard`);
    } catch (e) {
      console.warn("[realtime] connect failed:", e);
      try { await connection.stop(); } catch {}
      connection = null;
    }
  };

  window.stopRealtime = async function stopRealtime() {
    if (!connection) return;
    try { await connection.stop(); } catch {}
    connection = null;
  };
})();
