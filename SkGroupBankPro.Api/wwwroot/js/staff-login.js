document.addEventListener("DOMContentLoaded", () => {
  const el = (id) => document.getElementById(id);

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
      const res = await fetch(`${window.API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username || username);
      localStorage.setItem("role", data.role || "Staff");

      location.href = "staff.html";
    } catch (e) {
      if (err) err.textContent = String(e?.message || e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  el("btnLogin")?.addEventListener("click", login);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Enter") login(); });
});
