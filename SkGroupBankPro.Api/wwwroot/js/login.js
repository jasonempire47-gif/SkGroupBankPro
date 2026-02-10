// wwwroot/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  const el = (id) => document.getElementById(id);

  function apiBase() {
    const b = (window.API_BASE || "").trim();
    return b ? b.replace(/\/+$/, "") : "";
  }

  function redirectByRole(role) {
    const r = String(role || "").trim();

    // Adjust these if your page names differ
    if (r === "Staff") location.href = "staff.html";
    else if (r === "Finance") location.href = "finance.html";
    else if (r === "Admin") location.href = "dashboard.html";
    else location.href = "dashboard.html";
  }

  async function login() {
    const username = (el("username")?.value || "").trim();
    const password = (el("password")?.value || "").trim();
    const err = el("loginError");
    const btn = el("btnLogin");

    if (err) err.textContent = "";
    if (!username || !password) {
      if (err) err.textContent = "Please enter username and password.";
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const res = await fetch(`${apiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Expected shape:
      // { token: "...", user: { id, username, role } }
      const token = data?.token;
      const user = data?.user || {};
      const role = user?.role || "";
      const uName = user?.username || username;

      if (!token) throw new Error("Login succeeded but token is missing.");

      localStorage.setItem("token", token);
      localStorage.setItem("username", uName);
      localStorage.setItem("role", role);

      redirectByRole(role);
    } catch (e) {
      if (err) err.textContent = String(e?.message || e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  el("btnLogin")?.addEventListener("click", login);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") login();
  });
});
