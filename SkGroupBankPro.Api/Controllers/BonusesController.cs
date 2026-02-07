using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;
using SkGroupBankpro.Api.Services;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/bonuses")]
    [Authorize]
    public sealed class BonusesController(AppDbContext db) : ControllerBase
    {
        private readonly AppDbContext _db = db;

        private int CurrentUserId()
        {
            string? sub = User.FindFirst("sub")?.Value;
            return int.TryParse(sub, out int id) ? id : 0;
        }

        // ------------------------------------------------------------
        // POST /api/bonuses
        // Creates a BONUS credit transaction for a customer
        // ------------------------------------------------------------
        [HttpPost]
        [Authorize(Roles = "Admin,Finance,Staff")]
        public async Task<ActionResult> Create([FromBody] CreateBonusRequest req)
        {
            if (req.CustomerId <= 0)
            {
                return BadRequest("CustomerId must be > 0.");
            }

            if (req.Amount <= 0)
            {
                return BadRequest("Amount must be > 0.");
            }

            if (req.GameTypeId <= 0)
            {
                return BadRequest("GameTypeId must be > 0.");
            }

            bool customerExists = await _db.Customers.AnyAsync(c => c.Id == req.CustomerId);
            if (!customerExists)
            {
                return NotFound("Customer not found.");
            }

            bool gameTypeExists = await _db.GameTypes.AnyAsync(g => g.Id == req.GameTypeId);
            if (!gameTypeExists)
            {
                return NotFound("GameType not found.");
            }

            // If your WalletTransaction does NOT have GameTypeId or TxDate, keep only the common fields.
            // Add these only if you already have them in the model:
            // - GameTypeId
            // - TxAt (DateTime)
            // If you don't have them, remove those assignments.

            WalletTransaction tx = new()
            {
                CustomerId = req.CustomerId,
                Type = TxType.Bonus,                 // Make sure TxType has Bonus
                Direction = TxDirection.Credit,
                Status = TxStatus.Approved,          // or Pending if you want approval workflow
                Amount = req.Amount,
                Notes = BuildNotes(req),
                CreatedByUserId = CurrentUserId(),
                CreatedAt = req.DateUtc?.ToUniversalTime() ?? DateTime.UtcNow
            };

            _ = _db.WalletTransactions.Add(tx);
            _ = await _db.SaveChangesAsync();

            return Ok(tx);
        }

        // ------------------------------------------------------------
        // GET /api/bonuses?take=50&customerId=1
        // Recent bonus transactions
        // ------------------------------------------------------------
        [HttpGet]
        public async Task<ActionResult> List([FromQuery] int take = 50, [FromQuery] int? customerId = null)
        {
            if (take <= 0)
            {
                take = 50;
            }

            if (take > 500)
            {
                take = 500;
            }

            IQueryable<WalletTransaction> q = _db.WalletTransactions.AsNoTracking()
                .Where(t => t.Type == TxType.Bonus);

            if (customerId.HasValue)
            {
                q = q.Where(t => t.CustomerId == customerId.Value);
            }

            var data = await (
                from t in q
                join c in _db.Customers.AsNoTracking() on t.CustomerId equals c.Id
                orderby t.CreatedAt descending, t.Id descending
                select new
                {
                    t.Id,
                    t.CustomerId,
                    CustomerName = c.Name,
                    t.Amount,
                    t.Status,
                    t.Notes,
                    t.CreatedByUserId,
                    t.CreatedAt
                }
            ).Take(take).ToListAsync();

            return Ok(data);
        }

        private static string BuildNotes(CreateBonusRequest req)
        {
            // Store game + optional reason in Notes so you don't need schema changes yet.
            // Example: "Game=JILI; Reason=Welcome bonus"
            string reasonPart = string.IsNullOrWhiteSpace(req.Reason) ? "" : $"; Reason={req.Reason.Trim()}";
            return $"GameTypeId={req.GameTypeId}{reasonPart}";
        }
    }

    // DTO
    public sealed record CreateBonusRequest(
        int CustomerId,
        int GameTypeId,
        decimal Amount,
        string? Reason,
        DateTime? DateUtc // allow editable date-time from UI
    );
}
