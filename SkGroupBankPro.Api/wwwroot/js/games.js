// wwwroot/js/games.js
document.addEventListener("DOMContentLoaded", () => {
  try { requireAuth(); } catch {}

  const $ = (id) => document.getElementById(id);

  const selCustomer = $("selCustomer");
  const gameSearch = $("gameSearch");
  const btnAddGame = $("btnAddGame");
  const btnRefresh = $("btnRefreshGames");
  const tbody = $("gameTbody");
  const gameCount = $("gameCount");
  const gameUpdated = $("gameUpdated");
  const gameMsg = $("gameMsg");

  // modal
  const modalBackdrop = $("modalBackdrop");
  const modalTitle = $("modalTitle");
  const modalBody = $("modalBody");
  const btnModalSave = $("btnModalSave");
  const btnModalCancel = $("btnModalCancel");
  const btnModalCancel2 = $("btnModalCancel2");
  let modalOnSave = null;

  let games = [];
  let allTx = [];
  let rows = [];

  function nowText() { return new Date().toLocaleString("en-GB"); }
  function money(x) { const n = Number(x || 0); return n.toFixed(2); }

  function setMsg(text, ok = true) {
    if (!gameMsg) return;
    gameMsg.textContent = text || "";
    gameMsg.className = "msg " + (ok ? "ok" : "bad");
    if (!text) gameMsg.className = "msg";
  }

  function openModal(title, html, onSave) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modalOnSave = onSave || null;
    modalBackdrop.style.display = "flex";
  }

  function closeModal() {
    modalBackdrop.style.display = "none";
    modalBody.innerHTML = "";
    modalOnSave = null;
  }

  function isApproved(t) {
    return String(t.status || "").toLowerCase() === "approved";
  }

  function signedAmount(t) {
    const amt = Number(t.amount || 0);
    if (!Number.isFinite(amt)) return 0;
    const dir = String(t.direction || "").toLowerCase();
    return dir === "debit" ? -amt : amt;
  }

  async function loadCustomers() {
    const customers = await apiFetch("/api/customers").catch(() => []);
    selCustomer.innerHTML =
      `<option value="">Select customer...</option>` +
      (customers || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  async function loadGameTypes() {
    const all = await apiFetch("/api/gametypes").catch(() => []);
    games = (all || []).filter(g => g.isEnabled !== false);
  }

  async function loadCustomerTransactions(customerId) {
    if (!customerId) return [];
    return await apiFetch(`/api/transactions/by-customer?customerId=${encodeURIComponent(customerId)}&take=5000`).catch(() => []);
  }

  function computeRows() {
    rows = [];

    // map approved tx by gameTypeId
    const map = new Map();
    for (const t of (allTx || [])) {
      const gid = t.gameTypeId;
      if (!gid) continue;
      if (!isApproved(t)) continue;

      const bucket = map.get(gid) || { records: 0, balance: 0 };
      bucket.records += 1;
      bucket.balance += signedAmount(t);
      map.set(gid, bucket);
    }

    for (const g of games) {
      const m = map.get(g.id) || { records: 0, balance: 0 };
      rows.push({
        id: g.id,
        name: g.name,
        records: m.records,
        balance: m.balance
      });
    }
  }

  function render() {
    const customerId = selCustomer.value;
    const q = (gameSearch.value || "").trim().toLowerCase();

    if (!customerId) {
      tbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">Select customer first.</td></tr>`;
      gameCount.textContent = `0 game(s)`;
      return;
    }

    const view = rows
      .filter(r => !q || r.name.toLowerCase().includes(q))
      .sort((a,b) => a.name.localeCompare(b.name));

    gameCount.textContent = `${view.length} game(s)`;

    if (!view.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">No game(s). Click <b>Add Game</b>.</td></tr>`;
      return;
    }

    tbody.innerHTML = view.map(r => `
      <tr data-id="${r.id}">
        <td style="width:260px;"><b>${escapeHtml(r.name)}</b></td>
        <td class="right mono" style="width:170px;">${escapeHtml(String(r.records))}</td>
        <td class="right mono" style="width:220px;"><span class="pill">${escapeHtml(money(r.balance))}</span></td>
        <td class="center" style="width:200px;">
          <button class="btn ghost" data-action="rename">Rename</button>
          <button class="btn ghost danger" data-action="disable">Disable</button>
        </td>
      </tr>
    `).join("");
  }

  async function refresh() {
    setMsg("");
    const customerId = selCustomer.value;

    if (!customerId) {
      allTx = [];
      computeRows();
      render();
      gameUpdated.textContent = "—";
      return;
    }

    allTx = await loadCustomerTransactions(customerId);
    computeRows();
    render();
    gameUpdated.textContent = `Updated: ${nowText()}`;
  }

  // ✅ Game kiosk: Add Game modal
  function openAddGame() {
    openModal("Add Game", `
      <div class="formRow">
        <label class="label">Game Name</label>
        <input id="mGameName" class="input" type="text" placeholder="e.g. Pussy888 / Live22" />
      </div>
      <div class="mutedSmall" style="margin-top:10px;">
        This will be saved to DB and appear in all pages.
      </div>
      <div id="mErr" class="msg bad" style="margin-top:10px;"></div>
    `, async () => {
      const name = ($("mGameName")?.value || "").trim();
      const err = $("mErr");
      if (err) err.textContent = "";

      if (!name) {
        if (err) err.textContent = "Game name is required.";
        return;
      }

      try {
        await apiFetch("/api/gametypes", {
          method: "POST",
          body: JSON.stringify({ name })
        });

        closeModal();

        // reload games from DB so it shows immediately
        await loadGameTypes();
        await refresh();

        setMsg("Game added.", true);
      } catch (e) {
        const msg = String(e?.message || e || "Failed to add game.");
        if (err) err.textContent = msg;
        else setMsg(msg, false);
      }
    });
  }

  // rename / disable actions
  function openRename(gameId) {
    const g = games.find(x => String(x.id) === String(gameId));
    if (!g) return;

    openModal("Rename Game", `
      <div class="formRow">
        <label class="label">Game Name</label>
        <input id="mGameName" class="input" type="text" value="${escapeHtml(g.name)}" />
      </div>
      <div id="mErr" class="msg bad" style="margin-top:10px;"></div>
    `, async () => {
      const name = ($("mGameName")?.value || "").trim();
      const err = $("mErr");
      if (err) err.textContent = "";

      if (!name) {
        if (err) err.textContent = "Name is required.";
        return;
      }

      try {
        await apiFetch(`/api/gametypes/${gameId}`, {
          method: "PATCH",
          body: JSON.stringify({ name })
        });

        closeModal();
        await loadGameTypes();
        await refresh();
        setMsg("Game renamed.", true);
      } catch (e) {
        const msg = String(e?.message || e || "Rename failed.");
        if (err) err.textContent = msg;
        else setMsg(msg, false);
      }
    });
  }

  async function disableGame(gameId) {
    try {
      await apiFetch(`/api/gametypes/${gameId}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: false })
      });
      await loadGameTypes();
      await refresh();
      setMsg("Game disabled.", true);
    } catch (e) {
      setMsg(String(e?.message || e || "Disable failed."), false);
    }
  }

  // events
  btnAddGame.addEventListener("click", openAddGame);
  btnRefresh.addEventListener("click", refresh);
  selCustomer.addEventListener("change", refresh);
  gameSearch.addEventListener("input", render);

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const tr = btn.closest("tr[data-id]");
    if (!tr) return;

    const id = tr.getAttribute("data-id");
    const act = btn.getAttribute("data-action");

    if (act === "rename") return openRename(id);
    if (act === "disable") return disableGame(id);
  });

  btnModalSave.addEventListener("click", async () => {
    if (typeof modalOnSave === "function") await modalOnSave();
  });

  btnModalCancel?.addEventListener("click", closeModal);
  btnModalCancel2?.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  // init
  (async () => {
    await loadCustomers();
    await loadGameTypes();
    await refresh();
  })();
});
