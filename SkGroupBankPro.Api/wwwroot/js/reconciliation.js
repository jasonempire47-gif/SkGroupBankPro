// wwwroot/js/reconciliation.js
document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const $ = (id) => document.getElementById(id);

  const selCustomer = $("selCustomer");
  const btnRefresh = $("btnRefresh");

  const sumTbody = $("sumTbody");
  const sumUpdated = $("sumUpdated");
  const sumDiff = $("sumDiff");
  const msg = $("msg");

  const bankSearch = $("bankSearch");
  const bankTbody = $("bankTbody");
  const bankCount = $("bankCount");
  const bankTotal = $("bankTotal");

  const gameSearch = $("gameSearch");
  const gameTbody = $("gameTbody");
  const gameCount = $("gameCount");
  const gameTotal = $("gameTotal");

  // MUST match your existing keys
  const BANK_OPENING_PREFIX = "bank_opening_v1";      // if your finance.js uses something else, tell me
  const GAME_OPENING_PREFIX = "games_opening_v1";     // matches games.js I gave you

  let gameTypes = []; // [{id,name,isEnabled}]
  let txAll = [];     // all tx for selected customer (or empty)

  function nowText() {
    return new Date().toLocaleString("en-GB");
  }

  function setMsg(text, ok = true) {
    msg.textContent = text || "";
    msg.className = "msg " + (ok ? "ok" : "bad");
    if (!text) msg.className = "msg";
  }

  function money(x) {
    const n = Number(x || 0);
    return n.toFixed(2);
  }

  function parseNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function isApproved(t) {
    return String(t.status || "").toLowerCase() === "approved";
  }

  function dirSign(t) {
    return String(t.direction || "").toLowerCase() === "debit" ? -1 : 1;
  }

  function bankOpeningKey(bankName) {
    return `${BANK_OPENING_PREFIX}:${bankName}`;
  }

  function getBankOpening(bankName) {
    const raw = localStorage.getItem(bankOpeningKey(bankName));
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function gameOpeningKey(customerId, gameTypeId) {
    return `${GAME_OPENING_PREFIX}:${customerId}:${gameTypeId}`;
  }

  function getGameOpening(customerId, gameTypeId) {
    const raw = localStorage.getItem(gameOpeningKey(customerId, gameTypeId));
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  async function loadCustomers() {
    const customers = await apiFetch("/api/customers");
    selCustomer.innerHTML =
      `<option value="">Select customer...</option>` +
      (customers || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  async function loadGameTypes() {
    const all = await apiFetch("/api/gametypes");
    gameTypes = (all || []).filter(g => g.isEnabled !== false);
  }

  // IMPORTANT: requires backend GET to allow customerId without gameTypeId
  async function loadTransactionsForCustomer(customerId) {
    const qs = `?customerId=${encodeURIComponent(customerId)}`;
    const tx = await apiFetch(`/api/wallet-transactions${qs}`).catch(() => []);
    return Array.isArray(tx) ? tx : [];
  }

  function computeBankGroups(customerId) {
    // Finance side: group by BankType (approved only)
    const map = new Map(); // bankName -> {bank, opening, net, balance}

    for (const t of txAll) {
      if (!isApproved(t)) continue;

      const bank = (t.bankType || "").trim() || "—";
      const amt = parseNum(t.amount);
      const netPart = dirSign(t) * amt;

      if (!map.has(bank)) {
        const opening = getBankOpening(bank);
        map.set(bank, { bank, opening, net: 0, balance: 0 });
      }

      map.get(bank).net += netPart;
    }

    const rows = [...map.values()].map(x => {
      x.balance = x.opening + x.net;
      return x;
    }).sort((a, b) => String(a.bank).localeCompare(String(b.bank)));

    // totals
    const totalOpening = rows.reduce((s, r) => s + r.opening, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

    return { rows, totalOpening, totalNet, totalBalance };
  }

  function computeGameGroups(customerId) {
    // Games side: group by GameTypeId (approved only)
    const map = new Map(); // gameTypeId -> {game, opening, net, balance}

    // initialize all enabled games (so you see 0 rows too)
    for (const g of gameTypes) {
      const opening = getGameOpening(customerId, g.id);
      map.set(String(g.id), { gameId: g.id, game: g.name, opening, net: 0, balance: 0 });
    }

    for (const t of txAll) {
      if (!isApproved(t)) continue;

      const gid = t.gameTypeId;
      if (gid == null) continue; // not a game tx

      const key = String(gid);
      if (!map.has(key)) {
        // game exists in tx but not enabled list
        const opening = getGameOpening(customerId, gid);
        map.set(key, { gameId: gid, game: `Game#${gid}`, opening, net: 0, balance: 0 });
      }

      const amt = parseNum(t.amount);
      map.get(key).net += dirSign(t) * amt;
    }

    const rows = [...map.values()].map(x => {
      x.balance = x.opening + x.net;
      return x;
    }).sort((a, b) => String(a.game).localeCompare(String(b.game)));

    // totals
    const totalOpening = rows.reduce((s, r) => s + r.opening, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

    return { rows, totalOpening, totalNet, totalBalance };
  }

  function renderSummary(fin, gam) {
    const finBal = fin.totalBalance;
    const gamBal = gam.totalBalance;
    const diff = finBal - gamBal;

    sumTbody.innerHTML = `
      <tr>
        <td style="width:260px;"><b>Finance (Banks)</b></td>
        <td class="right mono" style="width:180px;">${escapeHtml(money(fin.totalOpening))}</td>
        <td class="right mono" style="width:200px;">${escapeHtml(money(fin.totalNet))}</td>
        <td class="right mono" style="width:200px;"><span class="pill">${escapeHtml(money(finBal))}</span></td>
      </tr>
      <tr>
        <td style="width:260px;"><b>Games (Credits)</b></td>
        <td class="right mono" style="width:180px;">${escapeHtml(money(gam.totalOpening))}</td>
        <td class="right mono" style="width:200px;">${escapeHtml(money(gam.totalNet))}</td>
        <td class="right mono" style="width:200px;"><span class="pill">${escapeHtml(money(gamBal))}</span></td>
      </tr>
    `;

    sumUpdated.textContent = `Updated: ${nowText()}`;

    const ok = Math.abs(diff) < 0.0001;
    sumDiff.textContent = ok
      ? `Difference: 0.00 ✅ (Balanced)`
      : `Difference: ${money(diff)} ⚠️ (Finance - Games)`;

    setMsg(
      ok ? "Balanced: Finance equals Games." : "Mismatch detected: investigate bank/game adjustments.",
      ok
    );
  }

  function renderBanks(fin) {
    const q = (bankSearch.value || "").trim().toLowerCase();
    const filtered = fin.rows.filter(r => !q || String(r.bank).toLowerCase().includes(q));

    bankCount.textContent = `${filtered.length} bank(s)`;
    bankTotal.textContent = `Total Bank Balance: ${money(fin.totalBalance)}`;

    if (!filtered.length) {
      bankTbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">No bank records.</td></tr>`;
      return;
    }

    bankTbody.innerHTML = filtered.map(r => `
      <tr>
        <td style="width:260px;"><b>${escapeHtml(r.bank)}</b></td>
        <td class="right mono" style="width:180px;">${escapeHtml(money(r.opening))}</td>
        <td class="right mono" style="width:200px;">${escapeHtml(money(r.net))}</td>
        <td class="right mono" style="width:200px;"><span class="pill">${escapeHtml(money(r.balance))}</span></td>
      </tr>
    `).join("");
  }

  function renderGames(gam) {
    const q = (gameSearch.value || "").trim().toLowerCase();
    const filtered = gam.rows.filter(r => !q || String(r.game).toLowerCase().includes(q));

    gameCount.textContent = `${filtered.length} game(s)`;
    gameTotal.textContent = `Total Game Balance: ${money(gam.totalBalance)}`;

    if (!filtered.length) {
      gameTbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">No game records.</td></tr>`;
      return;
    }

    gameTbody.innerHTML = filtered.map(r => `
      <tr>
        <td style="width:260px;"><b>${escapeHtml(r.game)}</b></td>
        <td class="right mono" style="width:180px;">${escapeHtml(money(r.opening))}</td>
        <td class="right mono" style="width:200px;">${escapeHtml(money(r.net))}</td>
        <td class="right mono" style="width:200px;"><span class="pill">${escapeHtml(money(r.balance))}</span></td>
      </tr>
    `).join("");
  }

  async function refresh() {
    setMsg("");

    const customerId = selCustomer.value;
    if (!customerId) {
      txAll = [];
      sumTbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">Select a customer.</td></tr>`;
      bankTbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">Select a customer.</td></tr>`;
      gameTbody.innerHTML = `<tr><td colspan="4" class="mutedSmall">Select a customer.</td></tr>`;
      sumUpdated.textContent = "—";
      sumDiff.textContent = "—";
      bankCount.textContent = "0 bank(s)";
      gameCount.textContent = "0 game(s)";
      bankTotal.textContent = "—";
      gameTotal.textContent = "—";
      return;
    }

    txAll = await loadTransactionsForCustomer(customerId);

    const fin = computeBankGroups(customerId);
    const gam = computeGameGroups(customerId);

    renderSummary(fin, gam);
    renderBanks(fin);
    renderGames(gam);
  }

  btnRefresh.addEventListener("click", refresh);
  selCustomer.addEventListener("change", refresh);
  bankSearch.addEventListener("input", () => {
    const customerId = selCustomer.value;
    if (!customerId) return;
    const fin = computeBankGroups(customerId);
    renderBanks(fin);
  });
  gameSearch.addEventListener("input", () => {
    const customerId = selCustomer.value;
    if (!customerId) return;
    const gam = computeGameGroups(customerId);
    renderGames(gam);
  });

  (async function init() {
    await loadCustomers();
    await loadGameTypes();
    await refresh();
  })();
});
