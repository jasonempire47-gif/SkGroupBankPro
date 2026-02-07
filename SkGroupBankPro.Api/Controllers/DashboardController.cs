using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/dashboard")]
    [Authorize]
    public sealed class DashboardController(AppDbContext db) : ControllerBase
    {
        private readonly AppDbContext _db = db;

        // GET /api/dashboard/summary?take=20
        [HttpGet("summary")]
        public async Task<IActionResult> Summary([FromQuery] int take = 20)
        {
            if (take <= 0)
            {
                take = 20;
            }

            if (take > 200)
            {
                take = 200;
            }

            DateTime todayUtc = DateTime.UtcNow.Date;
            DateTime tomorrowUtc = todayUtc.AddDays(1);

            int totalUsers = await _db.Customers.CountAsync();

            double todayDeposits = await _db.WalletTransactions
                .Where(t => t.Type == TxType.Deposit
                            && t.Status == TxStatus.Approved
                            && t.CreatedAt >= todayUtc && t.CreatedAt < tomorrowUtc)
                .Select(t => (double)t.Amount)
                .SumAsync();

            // Only meaningful if you use Pending status for withdrawals
            int pendingWithdrawals = await _db.WalletTransactions
                .Where(t => t.Type == TxType.Withdrawal && t.Status == TxStatus.Pending)
                .CountAsync();

            int activeGames = await _db.GameTypes.CountAsync(g => g.IsEnabled);

            var recent = await (
                from t in _db.WalletTransactions.AsNoTracking()
                join c in _db.Customers.AsNoTracking() on t.CustomerId equals c.Id
                orderby t.CreatedAt descending, t.Id descending
                select new
                {
                    t.Id,
                    User = c.Name,
                    Type = t.Type.ToString(),
                    t.Amount,
                    Status = t.Status.ToString(),
                    Date = t.CreatedAt
                }
            ).Take(take).ToListAsync();

            return Ok(new
            {
                totalUsers,
                todayDeposits = (decimal)todayDeposits,
                pendingWithdrawals,
                activeGames,
                recent
            });
        }
        // ------------------------------------------------------------
        // GET /api/dashboard/stats
        [HttpGet("stats")]
        public async Task<IActionResult> Stats()
        {
            DateTime today = DateTime.UtcNow.Date;

            int totalUsers = await _db.Customers.CountAsync();

            double todayDeposits = await _db.WalletTransactions
                .Where(t => t.Type == TxType.Deposit && t.CreatedAt >= today)
                .Select(t => (double)t.Amount)
                .SumAsync();

            int pendingWithdrawals = await _db.WalletTransactions
                .CountAsync(t => t.Type == TxType.Withdrawal && t.Status == TxStatus.Pending);

            int activeGames = await _db.GameTypes.CountAsync(g => g.IsEnabled);

            return Ok(new
            {
                totalUsers,
                todayDeposits = (decimal)todayDeposits,
                pendingWithdrawals,
                activeGames
            });
        }
    }
}
