// frontend/js/login.js
(function () {
  function $(id) { return document.getElementById(id); }

  function setError(msg) {
    const el = $("error") || $("loginError");
    if (el) el.textContent = msg || "";
  }

  async function doLogin() {
    const username = ($("username")?.value || "").trim();
    const password = ($("password")?.value || "").trim();

    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    try {
      // Swagger path: POST /api/auth/login
      const res = await window.api.post("/api/auth/login", { username, password });

      // Your API returns: { token, username, role }
      const token = res?.token;
      if (!token) throw new Error("Login succeeded but token not returned.");

      localStorage.setItem("token", token);
      localStorage.setItem("username", res?.username || username);
      localStorage.setItem("role", res?.role || "");

      // go dashboard
      window.location.href = "dashboard.html";
    } catch (e) {
      setError(e?.message || "Login failed.");
    }
  }

  // expose for inline onclick OR bind button
  window.login = doLogin;

  document.addEventListener("DOMContentLoaded", () => {
    const btn = $("btnLogin");
    if (btn) btn.addEventListener("click", doLogin);

    // Enter key support
    $("password")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") doLogin();
    });
  });
})();
