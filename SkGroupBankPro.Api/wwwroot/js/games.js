// wwwroot/js/games.js
document.addEventListener("DOMContentLoaded", () => {
  requireAuth(["Admin", "Staff"]);

  const $ = (id) => document.getElementById(id);

  const gamesTbody = $("gamesTbody");
  const gamesCount = $("gamesCount");

  const custTbody = $("custGamesTbody");
  const custCount = $("custGamesCount");

  const custSearch = $("custSearch");
  const gameSearch = $("gameSearch");
  const btnRefresh = $("btnRefreshGames");

  const norm = (s) => String(s || "").trim().toLowerCase();
  const money = (x) => Number(x || 0).toFixed(2);

  // 🔁 If your API uses different field names, adjust here only:
  function getGameName(t) {
    return t.gameTypeName || t.gameName || t.game || t.gameType || "";
  }
  function getCustomerName(t) {
    return t.customerName || t.customer || t.player || t.customerFullName || "";
  }

  async function load() {
    if (gamesTbody) gamesTbody.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;
    if (custTbody) custTbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;

    let txs = [];
    try {
      txs = await apiFetch("/api/transactions/all");
      if (!Array.isArray(txs)) txs = [];
    } catch (e) {
      console.error(e);
      if (gamesTbody) gamesTbody.innerHTML = `<tr><td colspan="4">Failed to load</td></tr>`;
      if (custTbody) custTbody.innerHTML = `<tr><td colspan="5">Failed to load</td></tr>`;
      return;
    }

    const approved = txs.filter(t => norm(t.status) === "approved");

    // -------- PER GAME --------
    const gMap = new Map();
    for (const t of approved) {
      const game = getGameName(t);
      if (!game) continue;

      const amt = Number(t.amount || 0);
      if (!amt) continue;

      const type = norm(t.type);
      if (!gMap.has(game)) gMap.set(game, { deposits: 0, withdrawals: 0, balance: 0 });

      const g = gMap.get(game);
      if (type === "deposit") { g.deposits += amt; g.balance -= amt; }
      if (type === "withdrawal") { g.withdrawals += amt; g.balance += amt; }
    }

    const gq = norm(gameSearch?.value);
    const gameRows = Array.from(gMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .filter(r => !gq || norm(r.name).includes(gq))
      .sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

    if (gamesCount) gamesCount.textContent = `${gameRows.length} game(s)`;

    if (gamesTbody) {
      gamesTbody.innerHTML = gameRows.length
        ? gameRows.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td class="right">${money(r.deposits)}</td>
            <td class="right">${money(r.withdrawals)}</td>
            <td class="right"><strong>${money(r.balance)}</strong></td>
          </tr>
        `).join("")
        : `<tr><td colspan="4" class="mutedSmall">No records</td></tr>`;
    }

    // -------- PER CUSTOMER + GAME --------
    const cgMap = new Map();
    for (const t of approved) {
      const customer = getCustomerName(t);
      const game = getGameName(t);
      if (!customer || !game) continue;

      const amt = Number(t.amount || 0);
      if (!amt) continue;

      const type = norm(t.type);
      const key = `${customer}||${game}`;

      if (!cgMap.has(key)) cgMap.set(key, { customer, game, deposits: 0, withdrawals: 0, balance: 0 });
      const r = cgMap.get(key);

      if (type === "deposit") { r.deposits += amt; r.balance -= amt; }
      if (type === "withdrawal") { r.withdrawals += amt; r.balance += amt; }
    }

    const cq = norm(custSearch?.value);

    const cgRows = Array.from(cgMap.values())
      .filter(r => {
        if (cq && !norm(r.customer).includes(cq)) return false;
        if (gq && !norm(r.game).includes(gq)) return false;
        return true;
      })
      .sort((a, b) => norm(a.customer).localeCompare(norm(b.customer)) || norm(a.game).localeCompare(norm(b.game)));

    if (custCount) custCount.textContent = `${cgRows.length} record(s)`;

    if (custTbody) {
      custTbody.innerHTML = cgRows.length
        ? cgRows.map(r => `
          <tr>
            <td>${escapeHtml(r.customer)}</td>
            <td>${escapeHtml(r.game)}</td>
            <td class="right">${money(r.deposits)}</td>
            <td class="right">${money(r.withdrawals)}</td>
            <td class="right"><strong>${money(r.balance)}</strong></td>
          </tr>
        `).join("")
        : `<tr><td colspan="5" class="mutedSmall">No records</td></tr>`;
    }
  }

  btnRefresh?.addEventListener("click", load);
  custSearch?.addEventListener("input", load);
  gameSearch?.addEventListener("input", load);

  load();
});
