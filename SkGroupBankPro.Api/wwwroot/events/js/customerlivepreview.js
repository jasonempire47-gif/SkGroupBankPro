// wwwroot/events/js/customerlivepreview.js
(() => {
  const KEY = "mgc_live_event_state_v1";

  const $ = (id) => document.getElementById(id);

  function readState(){
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  }

  function spinWheel(){
    const wheel = $("wheel");
    if (!wheel) return;

    // random final rotation (6 full spins + random)
    const spins = 360 * 6 + Math.floor(Math.random() * 360);
    wheel.style.transform = `rotate(${spins}deg)`;
  }

  function safeText(id, value){
    const el = $(id);
    if (el) el.textContent = value;
  }

  function applyState(state){
    // If your HTML doesn't have these yet, do nothing safely.
    const hasAny =
      $("liveSub") || $("livePrize") || $("liveWinner") || $("wheel");

    if (!hasAny) return;

    if (!state || !state.mode){
      safeText("liveSub", "Waiting for prizes...");
      safeText("livePrize", "—");
      safeText("liveWinner", "—");
      return;
    }

    if (state.mode === "idle"){
      safeText("liveSub", "Waiting for prizes...");
      safeText("livePrize", "—");
      safeText("liveWinner", "—");
      return;
    }

    if (state.mode === "prize"){
      safeText("liveSub", "Spinning for prize...");
      safeText("livePrize", state.prize || "—");
      safeText("liveWinner", "—");
      spinWheel();
      return;
    }

    if (state.mode === "winner"){
      safeText("liveSub", "WINNER!");
      safeText("livePrize", state.prize || "—");
      safeText("liveWinner", state.winner || "—");
      return;
    }

    // unknown mode fallback
    safeText("liveSub", "Waiting for prizes...");
    safeText("livePrize", "—");
    safeText("liveWinner", "—");
  }

  window.toggleFullscreen = () => {
    if(!document.fullscreenElement){
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyState(readState());

    // update when staff changes localStorage
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) applyState(readState());
    });

    // fallback polling every 2 seconds
    setInterval(() => applyState(readState()), 2000);
  });
})();
