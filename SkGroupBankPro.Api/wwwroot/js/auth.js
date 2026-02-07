// wwwroot/js/auth.js
(function () {
  window.requireAuth = function requireAuth() {
    const token = localStorage.getItem("token");
    if (!token) window.location.href = "index.html";
  };

  window.logout = function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "index.html";
  };
})();
