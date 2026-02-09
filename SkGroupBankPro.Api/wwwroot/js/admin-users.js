// wwwroot/js/admin-users.js
document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const $ = (id) => document.getElementById(id);

  // Role gate: only Admin can use this page
  const role = (localStorage.getItem("role") || "").trim();
  if (role !== "Admin") {
    alert("Admin only.");
    logout();
    location.href = "finance-login.html";
    return;
  }

  const btnGen = $("btnGen");
  const roleSel = $("roleSel");
  const msg = $("msg");

  const outRole = $("outRole");
  const outUser = $("outUser");
  const outPass = $("outPass");
  const btnCopyUser = $("btnCopyUser");
  const btnCopyPass = $("btnCopyPass");

  const usersTbody = $("usersTbody");
  const usersCount = $("usersCount");
  const btnClearList = $("btnClearList");

  const LS_KEY = "admin_generated_users_v1";

  function setMsg(text, ok = true) {
    msg.textContent = text || "";
    msg.className = "msg " + (ok ? "ok" : "bad");
    if (!text) msg.className = "msg";
  }

  function nowText() {
    try { return new Date().toLocaleString(); } catch { return String(new Date()); }
  }

  function loadList() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveList(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr || []));
  }

  function renderList() {
    const arr = loadList();
    usersTbody.innerHTML = arr.map((x, idx) => `
      <tr>
        <td>${escapeHtml(x.role || "")}</td>
        <td><code>${escapeHtml(x.username || "")}</code></td>
        <td><code>${escapeHtml(x.password || "")}</code></td>
        <td class="right">${escapeHtml(x.createdAt || "")}</td>
        <td class="center">
          <button class="btn ghost" data-act="copy-user" data-idx="${idx}">Copy User</button>
          <button class="btn ghost" data-act="copy-pass" data-idx="${idx}">Copy Pass</button>
        </td>
      </tr>
    `).join("");

    usersCount.textContent = `${arr.length} record(s)`;
  }

  async function copyText(text) {
    const t = String(text || "");
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setMsg("Copied to clipboard.", true);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setMsg("Copied to clipboard.", true);
    }
  }

  btnCopyUser?.addEventListener("click", () => copyText(outUser.textContent));
  btnCopyPass?.addEventListener("click", () => copyText(outPass.textContent));

  usersTbody?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const idx = Number(btn.getAttribute("data-idx") || "-1");
    const arr = loadList();
    if (idx < 0 || idx >= arr.length) return;

    if (act === "copy-user") copyText(arr[idx].username);
    if (act === "copy-pass") copyText(arr[idx].password);
  });

  btnClearList?.addEventListener("click", () => {
    if (!confirm("Clear the local generated users list?")) return;
    saveList([]);
    renderList();
    setMsg("Cleared local list.", true);
  });

  btnGen?.addEventListener("click", async () => {
    setMsg("");

    const selectedRole = roleSel.value;
    const token = localStorage.getItem("token");

    if (!token) {
      setMsg("Login as Admin first.", false);
      return;
    }

    btnGen.disabled = true;

    try {
      const res = await fetch(`${window.API_BASE}/api/auth/generate-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ role: selectedRole })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      outRole.textContent = data.role || "—";
      outUser.textContent = data.username || "—";
      outPass.textContent = data.password || "—";

      // store in local list
      const arr = loadList();
      arr.unshift({
        role: data.role,
        username: data.username,
        password: data.password,
        createdAt: nowText()
      });
      saveList(arr);

      renderList();
      setMsg("User generated.", true);
    } catch (e) {
      setMsg(String(e?.message || e), false);
    } finally {
      btnGen.disabled = false;
    }
  });

  // initial render
  renderList();
});
