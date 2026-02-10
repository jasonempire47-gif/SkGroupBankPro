// wwwroot/js/admin-clear.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnClearAllTx");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    requireAuth(["Admin"]);

    const pin = prompt("Enter Admin PIN to clear ALL transactions:");
    if (!pin) return;

    if (!confirm("This will permanently delete ALL transactions. Continue?")) return;

    try {
      await apiFetch("/api/admin-maintenance/clear-transactions", {
        method: "POST",
        body: JSON.stringify({ pin })
      });

      alert("All transactions cleared.");
      location.reload();
    } catch (e) {
      alert(String(e?.message || e));
    }
  });
});
