// wwwroot/js/admin-users.js
document.addEventListener("DOMContentLoaded", () => {
  // Admin only
  requireAuth(["Admin"]);

  const $ = (id) => document.getElementById(id);

  const roleSel = $("roleSel");
  const btnGen = $("btnGen");

  const outRole = $("outRole");
  const outUser = $("outUser");
  const outPass = $("outPass");

  const btnCopyUser = $("btnCopyUser");
  const btnCopyPass = $("btnCopyPass");

  const msg = $("msg");

  const usersTbody = $("usersTbody");
  const usersCount = $("usersCount");
  const btnClearList = $("btnClearList");

  const LS_KEY = "generatedUsers";

  function setMsg(text, kind = "") {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "msg" + (kind ? ` ${kind}` : "");
  }

  function loadLocalList() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLocalList(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr || []));
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  }

  function renderList() {
    const list = loadLocalList();

    if (usersCount) usersCount.textContent = `${list.length} record(s)`;
    if (!usersTbody) return;

    usersTbody.innerHTML = list
      .map((x, idx) => {
        return `
          <tr>
            <td>${escapeHtml(x.role || "-")}</td>
            <td>${escapeHtml(x.username || "-")}</td>
            <td>${escapeHtml(x.password || "-")}</td>
            <td class="right">${escapeHtml(fmtDate(x.createdAtUtc))}</td>
            <td class="center">
              <button class="btn ghost" data-act="copyUser" data-idx="${idx}">Copy User</button>
              <button class="btn ghost" data-act="copyPass" data-idx="${idx}">Copy Pass</button>
            </td>
          </tr>
        `;
      })
      .join("");

    usersTbody.querySelectorAll("button[data-act]").forEach((b) => {
      b.addEventListener("click", async () => {
        const act = b.getAttribute("data-act");
        const idx = Number(b.getAttribute("data-idx"));
        const item = loadLocalList()[idx];
        if (!item) return;

        const text = act === "copyUser" ? item.username : item.password;
        try {
          await navigator.clipboard.writeText(text || "");
          setMsg("Copied.", "ok");
          setTimeout(() => setMsg(""), 1200);
        } catch {
          setMsg("Copy failed (browser blocked clipboard).", "bad");
        }
      });
    });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text || "");
      setMsg("Copied.", "ok");
      setTimeout(() => setMsg(""), 1200);
    } catch {
      setMsg("Copy failed (browser blocked clipboard).", "bad");
    }
  }

  // ✅ This must match your backend route exactly
  // Swagger previously showed: POST /api/auth/generate-user
  async function generateUser(role) {
    // using apiFetch from auth.js (adds Bearer token)
    return await apiFetch("/api/auth/generate-user", {
      method: "POST",
      body: JSON.stringify({ role })
    });
  }

  async function onGenerate() {
    const role = (roleSel?.value || "Staff").trim();
    setMsg("");

    if (btnGen) btnGen.disabled = true;

    try {
      const data = await generateUser(role);

      // Accept both shapes:
      // { role, username, password }
      // OR { user: { role, username }, password }
      const r = data?.role || data?.user?.role || role;
      const u = data?.username || data?.user?.username || data?.userName || "";
      const p = data?.password || data?.pass || data?.plainPassword || "";

      if (!u || !p) throw new Error("Generate succeeded but username/password missing.");

      if (outRole) outRole.textContent = r;
      if (outUser) outUser.textContent = u;
      if (outPass) outPass.textContent = p;

      // store locally
      const list = loadLocalList();
      list.unshift({ role: r, username: u, password: p, createdAtUtc: new Date().toISOString() });
      saveLocalList(list);
      renderList();

      setMsg("User generated successfully.", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    } finally {
      if (btnGen) btnGen.disabled = false;
    }
  }

  btnGen?.addEventListener("click", onGenerate);

  btnCopyUser?.addEventListener("click", () => copy(outUser?.textContent || ""));
  btnCopyPass?.addEventListener("click", () => copy(outPass?.textContent || ""));

  btnClearList?.addEventListener("click", () => {
    saveLocalList([]);
    renderList();
    setMsg("List cleared.", "ok");
    setTimeout(() => setMsg(""), 1200);
  });

  // initial render
  renderList();
});
