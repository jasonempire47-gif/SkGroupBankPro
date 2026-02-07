// wwwroot/js/realtime.js
(function () {
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getApiBaseFromApiFetch() {
    // We don't have direct access to API_BASE variable from api.js,
    // so we derive it by requesting a relative URL and reading location.
    // BUT easiest: allow user to optionally set localStorage API_BASE.
    const ls = (localStorage.getItem("API_BASE") || "").trim();
    if (ls) return ls.replace(/\/+$/, "");
    // fallback: assume api.js default (localhost:5000)
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
      return;
    }
    if (connection) return;

    const base = getApiBaseFromApiFetch();
    const token = getToken();

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
      console.log("[realtime] connected");
    } catch (e) {
      console.warn("[realtime] connect failed:", e);
      // allow retry if needed
      connection = null;
    }
  };
})();
