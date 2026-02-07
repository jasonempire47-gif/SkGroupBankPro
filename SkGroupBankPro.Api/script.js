// script.js (login page) - FULL REPLACEMENT
(function () {
  /**
   * API base selection priority:
   * 1) window.API_BASE if you set it in HTML before loading this file
   * 2) Same origin (recommended) -> location.origin
   * 3) Fallback to localhost for dev
   */
  function getApiBase() {
    const base = (window.API_BASE || "").trim();
    if (base) return base.replace(/\/+$/, "");

    // If your frontend is served from the same server as the API,
    // this is the safest default.
    const origin = (location.origin || "").trim();
    if (origin && origin !== "null") return origin.replace(/\/+$/, "");

    // Last resort dev fallback
    return "http://localhost:5143";
  }

  const API_BASE = getApiBase();
  window.API_BASE = API_BASE; // expose for debugging

  function el(id) {
    return document.getElementById(id);
  }

  async function readResponse(res) {
    const text = await res.text();
    if (!text) return null;

    // Try JSON first, otherwise return text
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function login(e) {
    if (e?.preventDefault) e.preventDefault();

    const username = el("username")?.value?.trim();
    const password = el("password")?.value?.trim();
    const errorEl = el("loginError");
    const btn = el("btnLogin");

    if (!username || !password) {
      if (errorEl) errorEl.innerText = "Please enter username and password.";
      return;
    }

    if (errorEl) errorEl.innerText = "";

    // Disable button while logging in
    if (btn) btn.disabled = true;

    try {
      const url = `${API_BASE}/api/auth/login`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await readResponse(res);

      console.log("API_BASE:", API_BASE);
      console.log("LOGIN RESPONSE:", res.status, data);

      if (!res.ok) {
        const msg =
          (typeof data === "string" && data) ||
          data?.message ||
          data?.error ||
          `Login failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      if (!data?.token) {
        throw new Error("Token not returned by API");
      }

      localStorage.setItem("token", data.token);
      if (data.role) localStorage.setItem("role", data.role);
      if (data.username) localStorage.setItem("username", data.username);

      // Redirect
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Login error:", err);
      if (errorEl) errorEl.innerText = "Login failed: " + (err?.message || err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Allow calling login() from HTML onclick
  window.login = login;

  // Bind click + Enter key submit
  document.addEventListener("DOMContentLoaded", () => {
    const btn = el("btnLogin");
    if (btn) btn.addEventListener("click", login);

    // Optional: allow Enter key to trigger login if inputs exist
    const u = el("username");
    const p = el("password");
    [u, p].forEach((input) => {
      if (!input) return;
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") login(ev);
      });
    });
  });
})();
