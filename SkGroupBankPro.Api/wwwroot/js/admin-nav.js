// wwwroot/js/admin-nav.js
(function () {
  const path = (location.pathname || "").toLowerCase();

  const is = (name) => path.endsWith("/" + name) || path.endsWith("\\" + name) || path.endsWith(name);

  const map = [
    { id: "navDashboard", file: "dashboard.html", match: () => is("dashboard.html") },
    { id: "navFinance", file: "finance.html", match: () => is("finance.html") },
    { id: "navGames", file: "games.html", match: () => is("games.html") },
    { id: "navUsers", file: "admin-users.html", match: () => is("admin-users.html") },
  ];

  map.forEach(x => {
    const a = document.getElementById(x.id);
    if (!a) return;
    a.classList.remove("active");
    if (x.match()) a.classList.add("active");
  });

  // user chip
  const username = localStorage.getItem("username") || "Admin";
  const role = localStorage.getItem("role") || "Admin";
  const avatar = (username || "A").trim().slice(0, 1).toUpperCase();

  const el = (id) => document.getElementById(id);
  if (el("userName")) el("userName").textContent = username;
  if (el("userRole")) el("userRole").textContent = role;
  if (el("userAvatar")) el("userAvatar").textContent = avatar;

  // logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.logout) return window.logout();
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("username");
      window.location.href = "index.html";
    });
  }
})();
