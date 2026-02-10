// wwwroot/js/admin-guard.js
(function () {
  // Require login first
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // Admin-only
  const role = (localStorage.getItem("role") || "").trim();
  if (role !== "Admin") {
    // Optional: show message briefly (simple redirect only)
    window.location.href = "index.html";
    return;
  }
})();
