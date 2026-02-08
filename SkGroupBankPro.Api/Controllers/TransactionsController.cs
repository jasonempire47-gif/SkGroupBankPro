using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/transactions")]
[Authorize]
public sealed class TransactionsController(AppDbContext db, IHubContext<DashboardHub> hub) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IHubContext<DashboardHub> _hub = hub;

    private int CurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value;
        return int.TryParse(sub, out var id) ? id : 0;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 50)
    {
        take = Math.Clamp(take, 1, 200);

        var data = await (
            from t in _db.WalletTransactions.AsNoTracking()
            join c in _db.Customers.AsNoTracking() on t.CustomerId equals c.Id
            join g in _db.GameTypes.AsNoTracking() on t.GameTypeId equals g.Id into gj
            from g in gj.DefaultIfEmpty()
            orderby t.CreatedAtUtc descending, t.Id descending
            select new
            {
                id = t.Id,
                customerId = t.CustomerId,
                customerName = c.Name,

                type = (int)t.Type,
                typeName = t.Type.ToString(),

                amount = t.Amount,

                status = (int)t.Status,
                statusName = t.Status.ToString(),

                direction = (int)t.Direction,
                bankType = t.BankType,
                referenceNo = t.ReferenceNo,

                gameTypeId = t.GameTypeId,
                gameTypeName = g != null ? g.Name : null,

                notes = t.Notes,
                createdAtUtc = t.CreatedAtUtc
            }
        ).Take(take).ToListAsync();

        return Ok(data);
    }

    // ✅ Staff can CREATE deposit, but it will be Pending (for Finance approval)
    [HttpPost("deposit")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public Task<IActionResult> Deposit([FromBody] CreateTxRequest req) => CreateTx(req, TxType.Deposit);

    // (You didn't request change, so keep Withdrawal auto-approved)
    [HttpPost("withdrawal")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public Task<IActionResult> Withdrawal([FromBody] CreateTxRequest req) => CreateTx(req, TxType.Withdrawal);

    // ✅ Bonus is auto-approved (no need Finance action)
    [HttpPost("bonus")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public Task<IActionResult> Bonus([FromBody] CreateTxRequest req) => CreateTx(req, TxType.Bonus);

    private async Task<IActionResult> CreateTx(CreateTxRequest req, TxType type)
    {
        if (req.CustomerId <= 0) return BadRequest("CustomerId is required.");
        if (req.Amount <= 0) return BadRequest("Amount must be > 0.");

        var customerExists = await _db.Customers.AnyAsync(x => x.Id == req.CustomerId);
        if (!customerExists) return NotFound("Customer not found.");

        if (req.GameTypeId.HasValue)
        {
            var gameOk = await _db.GameTypes.AnyAsync(x => x.Id == req.GameTypeId.Value && x.IsEnabled);
            if (!gameOk) return BadRequest("Invalid or disabled game type.");
        }

        // ✅ NEW RULES:
        // Deposit = Pending (Finance approves/rejects)
        // Bonus = Approved (auto-approved)
        // Withdrawal = Approved (keep auto)
        var status = type switch
        {
            TxType.Deposit => TxStatus.Pending,
            TxType.Bonus => TxStatus.Approved,
            _ => TxStatus.Approved
        };

        var tx = new WalletTransaction
        {
            CustomerId = req.CustomerId,
            GameTypeId = req.GameTypeId,
            Amount = decimal.Round(req.Amount, 4),

            Type = type,
            Direction = type == TxType.Withdrawal ? TxDirection.Debit : TxDirection.Credit,
            Status = status,

            BankType = (req.BankType ?? "").Trim(),
            ReferenceNo = (req.ReferenceNo ?? "").Trim(),
            Notes = (req.Notes ?? "").Trim(),

            CreatedByUserId = CurrentUserId(),
            CreatedAtUtc = req.CreatedAtUtc ?? DateTime.UtcNow
        };

        _db.WalletTransactions.Add(tx);
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "transaction", action = "created", id = tx.Id });

        return Ok(new
        {
            id = tx.Id,
            tx.CustomerId,
            tx.GameTypeId,
            tx.Amount,
            type = (int)tx.Type,
            typeName = tx.Type.ToString(),
            status = (int)tx.Status,
            statusName = tx.Status.ToString(),
            tx.CreatedAtUtc
        });
    }

    // ✅ Finance-only approval control
    [HttpPatch("{id:int}/approve")]
    [Authorize(Roles = "Admin,Finance")]
    public async Task<IActionResult> Approve(int id)
    {
        var tx = await _db.WalletTransactions.FirstOrDefaultAsync(x => x.Id == id);
        if (tx == null) return NotFound("Transaction not found.");

        if (tx.Status == TxStatus.Approved) return Ok(tx);
        if (tx.Status == TxStatus.Rejected) return BadRequest("Already rejected.");

        tx.Status = TxStatus.Approved;
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "transaction", action = "approved", id });

        return Ok(tx);
    }

    [HttpPatch("{id:int}/reject")]
    [Authorize(Roles = "Admin,Finance")]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectReq? req)
    {
        var tx = await _db.WalletTransactions.FirstOrDefaultAsync(x => x.Id == id);
        if (tx == null) return NotFound("Transaction not found.");

        if (tx.Status == TxStatus.Rejected) return Ok(tx);
        if (tx.Status == TxStatus.Approved) return BadRequest("Already approved.");

        tx.Status = TxStatus.Rejected;

        var reason = (req?.Reason ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(reason))
        {
            tx.Notes = string.IsNullOrWhiteSpace(tx.Notes)
                ? $"REJECTED: {reason}"
                : $"{tx.Notes}\nREJECTED: {reason}";
        }

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "transaction", action = "rejected", id });

        return Ok(tx);
    }

    // ✅ Finance can edit mistakes (amount/bank/ref/notes/game)
    [HttpPatch("{id:int}")]
    [Authorize(Roles = "Admin,Finance")]
    public async Task<IActionResult> Edit(int id, [FromBody] EditTxRequest req)
    {
        var tx = await _db.WalletTransactions.FirstOrDefaultAsync(x => x.Id == id);
        if (tx == null) return NotFound("Transaction not found.");

        if (req.Amount <= 0) return BadRequest("Amount must be > 0.");
        if (string.IsNullOrWhiteSpace(req.BankType)) return BadRequest("BankType is required.");

        if (req.GameTypeId.HasValue)
        {
            var gameOk = await _db.GameTypes.AnyAsync(x => x.Id == req.GameTypeId.Value && x.IsEnabled);
            if (!gameOk) return BadRequest("Invalid or disabled game type.");
        }

        tx.Amount = decimal.Round(req.Amount, 4);
        tx.BankType = req.BankType.Trim();
        tx.ReferenceNo = (req.ReferenceNo ?? "").Trim();
        tx.Notes = (req.Notes ?? "").Trim();
        tx.GameTypeId = req.GameTypeId;

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "transaction", action = "edited", id });

        return Ok(tx);
    }

    public sealed class RejectReq
    {
        public string? Reason { get; set; }
    }

    public sealed record CreateTxRequest(
        int CustomerId,
        decimal Amount,
        string? Notes,
        DateTime? CreatedAtUtc,
        string? BankType,
        string? ReferenceNo,
        int? GameTypeId
    );

    public sealed class EditTxRequest
    {
        public decimal Amount { get; set; }
        public string BankType { get; set; } = "";
        public string? ReferenceNo { get; set; }
        public string? Notes { get; set; }
        public int? GameTypeId { get; set; }
    }
}
