using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/winloss")]
    [Authorize]
    public sealed class WinLossController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<DashboardHub> _hub;

        public WinLossController(AppDbContext db, IHubContext<DashboardHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        private int CurrentUserId()
        {
            string? sub = User.FindFirst("sub")?.Value;
            return int.TryParse(sub, out int id) ? id : 0;
        }

        private string? Ip() => HttpContext?.Connection?.RemoteIpAddress?.ToString();

        private static TimeZoneInfo GetPngTimeZone()
        {
            var id = OperatingSystem.IsWindows()
                ? "West Pacific Standard Time"
                : "Pacific/Port_Moresby";

            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }

        private static DateTime EnsureUtc(DateTime dt)
        {
            if (dt.Kind == DateTimeKind.Utc) return dt;
            if (dt.Kind == DateTimeKind.Unspecified) return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
            return dt.ToUniversalTime();
        }

        // ✅ Convert any UTC moment -> PNG business date -> PNG midnight -> UTC anchor
        private static DateTime ToPngBusinessUtcAnchor(DateTime utcMoment)
        {
            var tz = GetPngTimeZone();
            var pngLocal = TimeZoneInfo.ConvertTimeFromUtc(utcMoment, tz);
            var pngDate = pngLocal.Date;

            var pngMidnight = new DateTime(
                pngDate.Year, pngDate.Month, pngDate.Day,
                0, 0, 0,
                DateTimeKind.Unspecified
            );

            var utcAnchor = TimeZoneInfo.ConvertTimeToUtc(pngMidnight, tz);
            return DateTime.SpecifyKind(utcAnchor, DateTimeKind.Utc);
        }

        // ✅ Correct daily net loss:
        //    NetLoss = max(0, SUM(Loss) - SUM(Win)) for that customer+game+PNG day.
        private async Task RecomputeDailyWinLoss(int customerId, int gameTypeId, DateTime dayUtcAnchor)
        {
            dayUtcAnchor = DateTime.SpecifyKind(dayUtcAnchor, DateTimeKind.Utc);

            var agg = await _db.WinLosses
                .Where(x => x.CustomerId == customerId && x.GameTypeId == gameTypeId && x.DateUtc == dayUtcAnchor)
                .GroupBy(x => 1)
                .Select(g => new
                {
                    win = g.Sum(x => x.WinAmount),
                    loss = g.Sum(x => x.LossAmount)
                })
                .FirstOrDefaultAsync();

            var win = agg?.win ?? 0m;
            var loss = agg?.loss ?? 0m;

            var netLoss = loss - win;
            if (netLoss < 0) netLoss = 0;
            netLoss = decimal.Round(netLoss, 4);

            var daily = await _db.DailyWinLosses.FirstOrDefaultAsync(d =>
                d.CustomerId == customerId &&
                d.GameTypeId == gameTypeId &&
                d.DateUtc == dayUtcAnchor
            );

            var hasAny = await _db.WinLosses.AnyAsync(x =>
                x.CustomerId == customerId && x.GameTypeId == gameTypeId && x.DateUtc == dayUtcAnchor
            );

            if (!hasAny)
            {
                if (daily != null)
                    _db.DailyWinLosses.Remove(daily);
                return;
            }

            if (daily == null)
            {
                daily = new DailyWinLoss
                {
                    CustomerId = customerId,
                    GameTypeId = gameTypeId,
                    DateUtc = dayUtcAnchor,
                    Total = netLoss,
                    NetLoss = netLoss
                };
                _db.DailyWinLosses.Add(daily);
            }
            else
            {
                daily.Total = netLoss;
                daily.NetLoss = netLoss;
            }
        }

        private async Task WriteAudit(string action, string entity, object details)
        {
            var log = new AuditLog
            {
                UserId = CurrentUserId(),
                Entity = entity,
                Action = action,
                IpAddress = Ip(),
                DetailsJson = JsonSerializer.Serialize(details)
            };
            _db.AuditLogs.Add(log);
            await Task.CompletedTask;
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Finance,Staff")]
        public async Task<IActionResult> Create([FromBody] CreateWinLossRequest req)
        {
            if (req.WinAmount < 0 || req.LossAmount < 0)
                return BadRequest("Amounts must be >= 0");

            var customer = await _db.Customers.FindAsync(req.CustomerId);
            if (customer == null)
                return NotFound("Customer not found");

            var gameOk = await _db.GameTypes.AnyAsync(x => x.Id == req.GameTypeId && x.IsEnabled);
            if (!gameOk)
                return BadRequest("Invalid or disabled game type");

            var utcMoment = EnsureUtc(req.DateUtc);
            var dateUtcAnchor = ToPngBusinessUtcAnchor(utcMoment);

            var wl = new WinLoss
            {
                CustomerId = req.CustomerId,
                GameTypeId = req.GameTypeId,
                WinAmount = decimal.Round(req.WinAmount, 4),
                LossAmount = decimal.Round(req.LossAmount, 4),
                DateUtc = dateUtcAnchor,
                CreatedByUserId = CurrentUserId(),
                CreatedAtUtc = DateTime.UtcNow
            };

            using var tx = await _db.Database.BeginTransactionAsync();

            _db.WinLosses.Add(wl);
            await _db.SaveChangesAsync();

            await RecomputeDailyWinLoss(req.CustomerId, req.GameTypeId, dateUtcAnchor);

            await WriteAudit("CREATE", "WinLoss", new
            {
                wl.Id,
                wl.CustomerId,
                wl.GameTypeId,
                wl.WinAmount,
                wl.LossAmount,
                wl.DateUtc
            });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            await _hub.Clients.All.SendAsync("RebatesUpdated", new { entity = "winloss", action = "create" });
            await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "winloss", action = "create", id = wl.Id });

            return Ok(new { created = true, id = wl.Id });
        }

        [HttpPatch("{id:int}")]
        [Authorize(Roles = "Admin,Finance,Staff")]
        public async Task<IActionResult> Edit(int id, [FromBody] EditWinLossRequest req)
        {
            if (req.WinAmount < 0 || req.LossAmount < 0)
                return BadRequest("Amounts must be >= 0");

            var wl = await _db.WinLosses.FirstOrDefaultAsync(x => x.Id == id);
            if (wl == null) return NotFound("WinLoss not found");

            var customerOk = await _db.Customers.AnyAsync(x => x.Id == req.CustomerId);
            if (!customerOk) return NotFound("Customer not found");

            var gameOk = await _db.GameTypes.AnyAsync(x => x.Id == req.GameTypeId && x.IsEnabled);
            if (!gameOk) return BadRequest("Invalid or disabled game type");

            var before = new
            {
                wl.Id,
                wl.CustomerId,
                wl.GameTypeId,
                wl.WinAmount,
                wl.LossAmount,
                wl.DateUtc
            };

            var oldCustomerId = wl.CustomerId;
            var oldGameTypeId = wl.GameTypeId;
            var oldAnchor = DateTime.SpecifyKind(wl.DateUtc, DateTimeKind.Utc);

            var utcMoment = EnsureUtc(req.DateUtc);
            var newAnchor = ToPngBusinessUtcAnchor(utcMoment);

            using var tx = await _db.Database.BeginTransactionAsync();

            wl.CustomerId = req.CustomerId;
            wl.GameTypeId = req.GameTypeId;
            wl.WinAmount = decimal.Round(req.WinAmount, 4);
            wl.LossAmount = decimal.Round(req.LossAmount, 4);
            wl.DateUtc = newAnchor;

            await _db.SaveChangesAsync();

            await RecomputeDailyWinLoss(oldCustomerId, oldGameTypeId, oldAnchor);
            await RecomputeDailyWinLoss(wl.CustomerId, wl.GameTypeId, newAnchor);

            var after = new
            {
                wl.Id,
                wl.CustomerId,
                wl.GameTypeId,
                wl.WinAmount,
                wl.LossAmount,
                wl.DateUtc
            };

            await WriteAudit("EDIT", "WinLoss", new { before, after });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            await _hub.Clients.All.SendAsync("RebatesUpdated", new { entity = "winloss", action = "edit", id = wl.Id });
            await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "winloss", action = "edit", id = wl.Id });

            return Ok(new { updated = true, id = wl.Id });
        }
    }

    public sealed record CreateWinLossRequest(
        int CustomerId,
        int GameTypeId,
        decimal WinAmount,
        decimal LossAmount,
        DateTime DateUtc
    );

    public sealed record EditWinLossRequest(
        int CustomerId,
        int GameTypeId,
        decimal WinAmount,
        decimal LossAmount,
        DateTime DateUtc
    );
}
