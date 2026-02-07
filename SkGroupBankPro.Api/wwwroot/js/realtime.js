// wwwroot/js/realtime.js
(function () {
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  // ✅ Use the global API_BASE set by api.js
  function getApiBase() {
    const base = (window.API_BASE || "").trim();
    if (base) return base.replace(/\/+$/, "");

    // Optional fallback override (if you ever want to force it)
    const ls = (localStorage.getItem("API_BASE") || "").trim();
    if (ls) return ls.replace(/\/+$/, "");

    // Final fallback for local dev only
    return "http://localhost:5000";
  }

  const callbacks = new Set();
  let connection = null;

  window.onDashboardUpdated = function (cb) {
    callbacks.add(cb);
    return () => callbacks.delete(cb);
  };

  window.startRealtime = async function startRealtime() {
    if (!window.signalR) {
      console.warn("[realtime] signalR client not loaded.");
      return null;
    }
    if (connection) return connection;

    const base = getApiBase();

    connection = new signalR.HubConnectionBuilder()
      // ✅ IMPORTANT: call Render API hub, not Netlify origin
      .withUrl(`${base}/hubs/dashboard`, {
        accessTokenFactory: () => getToken(),
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
      return connection;
    } catch (e) {
      console.warn("[realtime] connect failed:", e);
      connection = null; // allow retry
      return null;
    }
  };

  window.stopRealtime = async function stopRealtime() {
    if (!connection) return;
    try {
      await connection.stop();
    } finally {
      connection = null;
    }
  };
})();
