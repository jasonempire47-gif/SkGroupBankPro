(() => {
  const $ = (id) => document.getElementById(id);

  function setMsg(t) {
    const el = $("wheelCtrlMsg");
    if (el) el.textContent = t || "";
  }

  function newToken() {
    return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  }

  function parseLines(text) {
    return String(text || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function parsePrizes(text) {
    const lines = parseLines(text);
    const prizes = [];

    for (const line of lines) {
      const parts = line.split("|").map((x) => x.trim());
      const name = parts[0];
      if (!name) continue;

      let weight = 1;
      if (parts[1]) {
        const n = Number(parts[1]);
        if (Number.isFinite(n) && n > 0) weight = n;
      }

      prizes.push({ name, weight });
    }

    return prizes;
  }

  function fillPrizeDropdown(prizes, selected) {
    const sel = $("wheelWinningPrize");
    if (!sel) return;

    sel.innerHTML = prizes
      .map((p) => {
        const s = p.name === selected ? " selected" : "";
        return `<option value="${escapeHtml(p.name)}"${s}>${escapeHtml(p.name)}</option>`;
      })
      .join("");

    if (!sel.value && prizes.length) sel.value = prizes[0].name;
  }

  function weightedRandomPrize(prizes) {
    const total = prizes.reduce((sum, p) => sum + (Number(p.weight) || 1), 0);
    let r = Math.random() * total;

    for (const p of prizes) {
      r -= (Number(p.weight) || 1);
      if (r <= 0) return p.name;
    }
    return prizes[0]?.name || "";
  }

  function randomCustomer(customers) {
    if (!customers.length) return "";
    return customers[Math.floor(Math.random() * customers.length)] || "";
  }

  // ---------- API state ----------
  async function getState() {
    const data = await apiFetch("/api/events/live-state", { cache: "no-store" });
    return (data && data.state) ? data.state : {};
  }

  async function saveState(state) {
    await apiFetch("/api/events/live-state", {
      method: "POST",
      body: JSON.stringify(state)
    });
  }

  let currentState = {};

  async function loadUI() {
    currentState = await getState();

    const prizes = Array.isArray(currentState.prizes) ? currentState.prizes : [];
    const customers = Array.isArray(currentState.customers) ? currentState.customers : [];

    $("wheelPrizesText").value = prizes.length
      ? prizes.map((p) => `${p.name} | ${p.weight || 1}`).join("\n")
      : "";

    $("wheelCustomersText").value = customers.length ? customers.join("\n") : "";

    $("wheelWinnerName").value = currentState.winnerName || "";
    $("wheelSpinMs").value = currentState.spinMs || 5000;
    $("wheelDecel").value = currentState.decel || 8;
    $("wheelMinRot").value = currentState.minRot || 6;

    fillPrizeDropdown(prizes, currentState.winningPrize || "");
    setMsg("Loaded from API.");
  }

  async function saveUI(patch = {}) {
    const prizes = parsePrizes($("wheelPrizesText").value);
    const customers = parseLines($("wheelCustomersText").value);

    const selectedPrize = $("wheelWinningPrize").value || prizes[0]?.name || "";
    const winnerName = ($("wheelWinnerName").value || "").trim();

    const spinMs = Math.max(1000, Number($("wheelSpinMs").value || 5000));
    const decel = Math.max(1, Number($("wheelDecel").value || 8));
    const minRot = Math.max(3, Number($("wheelMinRot").value || 6));

    const next = {
      ...currentState,
      prizes,
      customers,
      winningPrize: selectedPrize,
      winnerName,
      spinMs,
      decel,
      minRot,
      updatedAt: new Date().toISOString(),
      ...patch
    };

    fillPrizeDropdown(prizes, selectedPrize);

    await saveState(next);
    currentState = next;
    setMsg("Saved to API.");
    return next;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!$("wheelControllerPanel")) return;

    $("btnWheelLoad")?.addEventListener("click", async () => {
      try { await loadUI(); } catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelSave")?.addEventListener("click", async () => {
      try { await saveUI(); } catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelReset")?.addEventListener("click", async () => {
      try {
        $("wheelPrizesText").value = "";
        $("wheelCustomersText").value = "";
        $("wheelWinnerName").value = "";
        $("wheelSpinMs").value = 5000;
        $("wheelDecel").value = 8;
        $("wheelMinRot").value = 6;
        $("wheelWinningPrize").innerHTML = "";

        await saveState({});
        currentState = {};
        setMsg("Reset done.");
      } catch (e) {
        setMsg(e.message || String(e));
      }
    });

    $("btnWheelApplyPrizes")?.addEventListener("click", async () => {
      try { await saveUI(); setMsg("Prizes applied."); } catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelPickRandomPrize")?.addEventListener("click", async () => {
      try {
        const prizes = parsePrizes($("wheelPrizesText").value);
        if (!prizes.length) return setMsg("Add prizes first.");

        const pick = weightedRandomPrize(prizes);
        fillPrizeDropdown(prizes, pick);
        await saveUI({ winningPrize: pick });
        setMsg(`Picked prize: ${pick}`);
      } catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelApplyCustomers")?.addEventListener("click", async () => {
      try { await saveUI(); setMsg("Customers applied."); } catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelPickRandomCustomer")?.addEventListener("click", async () => {
      try {
        const customers = parseLines($("wheelCustomersText").value);
        if (!customers.length) return setMsg("Add customer names first.");

        const pick = randomCustomer(customers);
        $("wheelWinnerName").value = pick;
        await saveUI({ winnerName: pick });
        setMsg(`Picked customer: ${pick}`);
      } catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelSpinNow")?.addEventListener("click", async () => {
      try {
        const customers = parseLines($("wheelCustomersText").value);
        if (!$("wheelWinnerName").value.trim()) {
          const pick = randomCustomer(customers);
          if (pick) $("wheelWinnerName").value = pick;
        }

        const spinToken = newToken();
        await saveUI({ spinNow: true, spinToken });

        setMsg("Spin triggered.");
      } catch (e) {
        setMsg(e.message || String(e));
      }
    });

    $("btnWheelRevealWinner")?.addEventListener("click", async () => {
      try { await saveUI({ revealWinner: true }); setMsg("Reveal ON."); }
      catch (e) { setMsg(e.message || String(e)); }
    });

    $("btnWheelHideWinner")?.addEventListener("click", async () => {
      try { await saveUI({ revealWinner: false }); setMsg("Reveal OFF."); }
      catch (e) { setMsg(e.message || String(e)); }
    });

    loadUI().catch(e => setMsg(e.message || String(e)));
  });
})();
