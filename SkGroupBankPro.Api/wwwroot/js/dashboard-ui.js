// js/dashboard-ui.js
// Requires apiFetch() + API_BASE in js/api.js

function $(id){ return document.getElementById(id); }

function money(n){
  const num = Number(n ?? 0);
  if (Number.isNaN(num)) return "$0.00";
  return "$" + num.toFixed(2);
}

function toLocalDate(iso){
  try{
    const d = new Date(iso);
    return d.toISOString().slice(0,10);
  }catch{ return ""; }
}

function setText(id, val){ if($(id)) $(id).textContent = val; }

function statusBadge(status){
  const s = String(status ?? "").toLowerCase();
  if (s.includes("approved") || s.includes("completed")) return `<span class="badge badge-ok">Completed</span>`;
  if (s.includes("pending")) return `<span class="badge badge-warn">Pending</span>`;
  if (s.includes("rejected") || s.includes("flag")) return `<span class="badge badge-bad">Flagged</span>`;
  return `<span class="badge">${status ?? "-"}</span>`;
}

function typeLabel(t){
  const s = String(t ?? "").toLowerCase();
  if (s.includes("deposit")) return "Deposit";
  if (s.includes("withdraw")) return "Withdrawal";
  if (s.includes("rebate")) return "Rebate";
  return t ?? "-";
}

function downloadCsv(filename, rows){
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function loadDashboard(){
  // Header identity
  const username = localStorage.getItem("username") || "Admin";
  const role = localStorage.getItem("role") || "Administrator";
  setText("userName", username);
  setText("userRole", role);
  setText("userAvatar", (username[0] || "A").toUpperCase());

  // If no token, kick back to login
  const token = localStorage.getItem("token");
  if (!token){
    location.href = "index.html";
    return;
  }

  // 1) Total users/customers
  // Your API: /api/customers
  let customers = [];
  try{
    customers = await apiFetch("/api/customers", { method:"GET" });
  }catch(e){
    console.error(e);
  }
  setText("statTotalUsers", Array.isArray(customers) ? customers.length.toLocaleString() : "—");

  // 2) Today deposits / pending withdrawals / recent tx
  // Best practice: add endpoints for these.
  // For now we assume you have /api/transactions endpoint that returns latest rows.
  // If your endpoint differs, change ONLY this path.
  let tx = [];
  try{
    tx = await apiFetch("/api/transactions/recent?take=10", { method:"GET" });
  }catch{
    // fallback if you only have /api/transactions
    try{
      tx = await apiFetch("/api/transactions", { method:"GET" });
    }catch(e){
      console.error(e);
    }
  }

  // Normalize to array
  if (!Array.isArray(tx)) tx = [];

  // Compute stats from tx (today)
  const today = new Date().toISOString().slice(0,10);

  // IMPORTANT: your enums may be numbers. Adjust the mapping if needed.
  const isApproved = (t) => String(t.status).toLowerCase().includes("approved") || t.status === 1;
  const isPending = (t) => String(t.status).toLowerCase().includes("pending") || t.status === 0;
  const isDeposit = (t) => String(t.type).toLowerCase().includes("deposit") || t.type === 0;
  const isWithdraw = (t) => String(t.type).toLowerCase().includes("withdraw") || t.type === 1;

  let todayDeposits = 0;
  let pendingWithdrawals = 0;

  for (const t of tx){
    const d = toLocalDate(t.createdAt);
    if (d === today && isApproved(t) && isDeposit(t)) todayDeposits += Number(t.amount ?? 0);
    if (isPending(t) && isWithdraw(t)) pendingWithdrawals += 1;
  }

  setText("statTodayDeposits", money(todayDeposits));
  setText("statPendingWithdrawals", pendingWithdrawals.toLocaleString());

  // 3) Active Games (if you don’t have this yet, keep as placeholder)
  // If you add /api/games/active-count later, plug it here.
  setText("statActiveGames", "56"); // placeholder to match screenshot

  // 4) Recent transactions table (top 8)
  const rows = tx.slice(0,8).map(t => ({
    user: t.username || t.customerName || `Customer #${t.customerId ?? "-"}`,
    type: typeLabel(t.type),
    amount: money(t.amount),
    status: t.status ?? "-",
    date: toLocalDate(t.createdAt) || "-"
  }));

  const tbody = $("txTableBody");
  if (tbody){
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.user}</td>
        <td>${r.type}</td>
        <td class="num">${r.amount}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="num">${r.date}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" style="color:rgba(233,233,233,.55);padding:14px;">No transactions found.</td></tr>`;
  }

  // Export CSV
  $("btnExportCsv")?.addEventListener("click", () => {
    const csvRows = [
      ["User","Type","Amount","Status","Date"],
      ...rows.map(r => [r.user, r.type, r.amount, String(r.status), r.date])
    ];
    downloadCsv(`recent-transactions-${today}.csv`, csvRows);
  });

  // Logout
  $("btnLogout")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", loadDashboard);
