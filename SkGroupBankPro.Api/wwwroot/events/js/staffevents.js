// wwwroot/events/js/staffevents.js
(() => {
  const KEY = "mgc_live_event_state_v1";
  function $(id){ return document.getElementById(id); }

  function writeState(state){
    localStorage.setItem(KEY, JSON.stringify({
      mode: state.mode,
      prize: state.prize || "",
      winner: state.winner || "",
      updatedAt: new Date().toISOString()
    }));
  }

  function msg(text){
    const el = $("staffMsg");
    if (el) el.textContent = text || "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const prizeInput = $("prizeInput");
    const winnerInput = $("winnerInput");

    $("btnPushPrize")?.addEventListener("click", () => {
      writeState({
        mode: "prize",
        prize: prizeInput?.value?.trim() || "",
        winner: ""
      });
      msg("✅ Prize pushed to Live Preview.");
    });

    $("btnPushWinner")?.addEventListener("click", () => {
      writeState({
        mode: "winner",
        prize: prizeInput?.value?.trim() || "",
        winner: winnerInput?.value?.trim() || ""
      });
      msg("🎉 Winner announced on Live Preview!");
    });

    $("btnResetLive")?.addEventListener("click", () => {
      writeState({ mode: "idle", prize: "", winner: "" });
      msg("🔄 Live Preview reset.");
    });

    // initialize default if empty
    if (!localStorage.getItem(KEY)) {
      writeState({ mode: "idle", prize: "", winner: "" });
    }
  });
})();
