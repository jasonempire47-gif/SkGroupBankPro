// wwwroot/js/realtime.js
(function () {
  let hub = null;

  const dashHandlers = [];
  const rebateHandlers = [];

  function safeCall(list) {
    for (const fn of list) {
      try { fn(); } catch (e) { console.error(e); }
    }
  }

  // Expose hooks to pages
  window.onDashboardUpdated = function (cb) {
    if (typeof cb === "function") dashHandlers.push(cb);
  };

  window.onRebatesUpdated = function (cb) {
    if (typeof cb === "function") rebateHandlers.push(cb);
  };

  window.startRealtime = async function startRealtime() {
    if (hub && hub.state === "Connected") return;
    if (!window.signalR) {
      console.warn("SignalR not loaded. Check your <script> tag.");
      return;
    }

    hub = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/dashboard")
      .withAutomaticReconnect()
      .build();

    hub.on("DashboardUpdated", () => {
      console.log("🔄 DashboardUpdated");
      safeCall(dashHandlers);
    });

    hub.on("RebatesUpdated", () => {
      console.log("💸 RebatesUpdated");
      safeCall(rebateHandlers);
      safeCall(dashHandlers);
    });

    hub.onreconnecting((err) => console.warn("⚠️ SignalR reconnecting...", err));
    hub.onreconnected(() => console.log("✅ SignalR reconnected"));
    hub.onclose((err) => console.warn("⚠️ SignalR closed", err));

    try {
      await hub.start();
      console.log("✅ SignalR connected");
    } catch (err) {
      console.error("❌ SignalR start failed:", err);
      setTimeout(() => window.startRealtime(), 2000);
    }
  };
})();
