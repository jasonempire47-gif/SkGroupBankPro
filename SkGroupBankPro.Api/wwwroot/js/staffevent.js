document.addEventListener("DOMContentLoaded", async () => {
  // Require Admin/Staff
  if (typeof requireAuth === "function") {
    requireAuth(["Admin", "Staff"]);
  }

  const $ = (id) => document.getElementById(id);

  const prizeMsg = $("prizeMsg");
  const spinMsg = $("spinMsg");

  const pLabel = $("pLabel");
  const pType = $("pType");
  const pValue = $("pValue");
  const pCurrency = $("pCurrency");
  const pSort = $("pSort");
  const pEnabled = $("pEnabled");

  const sName = $("sName");
  const sRef = $("sRef");
  const sPrize = $("sPrize");
  const sBy = $("sBy");

  const prizeTbody = $("prizeTbody");

  function msg(el, text, ok) {
    el.className = "msg " + (ok ? "ok" : "bad");
    el.textContent = text;
  }

  function typeName(v){
    return ({1:"Percent Bonus",2:"Fixed Amount",3:"Free Spin",4:"Gift"})[v] || "";
  }

  async function loadPrizes() {
    // This endpoint is AllowAnonymous now, but apiFetch works fine too
    const rows = await apiFetch("/api/events/prizes");
    const enabled = rows.filter(x => x.isEnabled);

    // fill prize dropdown for spin
    sPrize.innerHTML = enabled.map(x => `<option value="${x.id}">${escapeHtml(x.label)} (${typeName(x.type)})</option>`).join("");
    if (!enabled.length) sPrize.innerHTML = `<option value="">No enabled prizes</option>`;

    // table
    prizeTbody.innerHTML = rows.map(x => `
      <tr>
        <td>${x.id}</td>
        <td>${escapeHtml(x.label)}</td>
        <td>${escapeHtml(typeName(x.type))}</td>
        <td class="right">${Number(x.value || 0).toFixed(2)}</td>
        <td>${escapeHtml(x.currency || "")}</td>
        <td>${x.isEnabled ? `<span class="badge ok">YES</span>` : `<span class="badge bad">NO</span>`}</td>
        <td class="right">${x.sortOrder || 0}</td>
        <td class="right">
          <button class="btnDanger" data-del="${x.id}">Delete</button>
        </td>
      </tr>
    `).join("");

    // delete handlers
    document.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("Delete prize #" + id + "?")) return;
        try {
          await apiFetch(`/api/events/prizes/${id}`, { method: "DELETE" });
          await loadPrizes();
        } catch (e) {
          alert("Delete failed: " + (e?.message || e));
        }
      };
    });
  }

  $("btnAddPrize").onclick = async () => {
    try {
      const payload = {
        id: null,
        label: (pLabel.value || "").trim(),
        type: Number(pType.value),
        value: Number(pValue.value || 0),
        currency: (pCurrency.value || "PHP").trim(),
        isEnabled: String(pEnabled.value) === "true",
        sortOrder: Number(pSort.value || 0),
      };

      const res = await apiFetch("/api/events/prizes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      msg(prizeMsg, `Saved: #${res.id} ${res.label}`, true);
      pLabel.value = "";
      pValue.value = "0";
      pSort.value = "0";

      await loadPrizes();
    } catch (e) {
      msg(prizeMsg, "Save failed: " + (e?.message || e), false);
    }
  };

  $("btnReloadPrizes").onclick = async () => {
    try {
      await loadPrizes();
      msg(prizeMsg, "Prizes reloaded.", true);
    } catch (e) {
      msg(prizeMsg, "Reload failed: " + (e?.message || e), false);
    }
  };

  $("btnRefreshTable").onclick = async () => {
    try { await loadPrizes(); } catch {}
  };

  $("btnSpin").onclick = async () => {
    try {
      const prizeId = Number(sPrize.value || 0);
      if (!prizeId) return msg(spinMsg, "Select an enabled prize first.", false);

      const payload = {
        customerName: (sName.value || "").trim(),
        customerReference: (sRef.value || "").trim() || null,
        prizeId,
        spunBy: (sBy.value || localStorage.getItem("username") || "Staff").trim()
      };

      if (!payload.customerName) return msg(spinMsg, "Customer name is required.", false);
      if (!payload.spunBy) return msg(spinMsg, "Spun By is required.", false);

      const res = await apiFetch("/api/events/spin", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      msg(spinMsg, `✅ SPIN OK: ${res.customerName} won "${res.prizeLabel}"`, true);
      sName.value = "";
      sRef.value = "";
    } catch (e) {
      msg(spinMsg, "Spin failed: " + (e?.message || e), false);
    }
  };

  $("btnOpenPreview").onclick = () => window.open("customerlivepreview.html", "_blank");

  $("btnLogout").onclick = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    location.href = "index.html";
  };

  // Sidebar collapse (if you already use it)
  $("btnSidebarToggle")?.addEventListener("click", () => {
    document.getElementById("appRoot")?.classList.toggle("sidebar-collapsed");
  });

  // init
  try {
    await loadPrizes();
    msg(prizeMsg, "Ready.", true);
  } catch (e) {
    msg(prizeMsg, "Failed to load prizes: " + (e?.message || e), false);
  }
});
