// wwwroot/js/auth.js
(function () {
  function getToken() {
    return localStorage.getItem("token");
  }

  window.requireAuth = function requireAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = "index.html";
      return;
    }
  };

  window.logout = function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "index.html";
  };

  // ✅ Login helper used by index.html
  window.doLogin = async function doLogin(username, password) {
    // IMPORTANT: always call via apiFetch so it uses API_BASE
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    // expected: { token, username, role }
    localStorage.setItem("token", res.token);
    localStorage.setItem("username", res.username || username);
    localStorage.setItem("role", res.role || "");

    return res;
  };
})();
