// wwwroot/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnLogin");
  const errorEl = document.getElementById("loginError");

  if (!btn) return;

  btn.addEventListener("click", login);

  async function login() {
    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password")?.value?.trim();

    errorEl.textContent = "";

    if (!username || !password) {
      errorEl.textContent = "Please enter username and password.";
      return;
    }

    btn.disabled = true;

    try {
      // ✅ ALWAYS use API_BASE from api.js
      const res = await fetch(`${window.API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Login failed");
      }

      const data = await res.json();

      // Save JWT
      localStorage.setItem("token", data.token);

      // Redirect after login
      window.location.href = "/dashboard.html";
    } catch (err) {
      console.error(err);
      errorEl.textContent = "Cannot reach API. Backend is not responding.";
    } finally {
      btn.disabled = false;
    }
  }
});
