using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/admin-maintenance")]
[Authorize(Roles = "Admin")]
public sealed class AdminMaintenanceController(AppDbContext db, IConfiguration cfg) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _cfg = cfg;

    public sealed class ClearRequest
    {
        public string Pin { get; set; } = "";
    }

    // POST /api/admin-maintenance/clear-transactions
    [HttpPost("clear-transactions")]
    public async Task<IActionResult> ClearTransactions([FromBody] ClearRequest req)
    {
        var pin = (_cfg["AdminWipePin"] ?? "").Trim();
        if (string.IsNullOrWhiteSpace(pin))
            return StatusCode(500, new { message = "AdminWipePin is not configured." });

        if (req == null || string.IsNullOrWhiteSpace(req.Pin) || req.Pin.Trim() != pin)
            return Unauthorized(new { message = "Invalid PIN." });

        // ✅ Adjust these table names ONLY if your actual EF tables differ.
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM WalletTransactions;");
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM WinLosses;");
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM DailyWinLosses;");

        // Optional: reset SQLite identity counters
        await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM sqlite_sequence WHERE name IN ('WalletTransactions','WinLosses','DailyWinLosses');"
        );

        return Ok(new { ok = true, message = "All transactions cleared." });
    }
}
