using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/winloss")]
    [Authorize]
    public sealed class WinLossController : ControllerBase
    {
        private readonly AppDbContext _db;

        public WinLossController(AppDbContext db)
        {
            _db = db;
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

        private static decimal NetLoss(decimal win, decimal loss)
        {
            var nl = loss - win;
            return decimal.Round(nl < 0 ? 0 : nl, 4);
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

            var game = await _db.GameTypes.FirstOrDefaultAsync(x => x.Id == req.GameTypeId && x.IsEnabled);
            if (game == null)
                return BadRequest("Invalid or disabled game type");

            var utcMoment = EnsureUtc(req.DateUtc);
            var dateUtcAnchor = ToPngBusinessUtcAnchor(utcMoment);

            var netLoss = NetLoss(req.WinAmount, req.LossAmount);

            using var tx = await _db.Database.BeginTransactionAsync();

            // 1️⃣ Save Win/Loss
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
            _db.WinLosses.Add(wl);

            // 2️⃣ Upsert DailyWinLoss (ACCUMULATE for the day)
            var daily = await _db.DailyWinLosses.FirstOrDefaultAsync(x =>
                x.CustomerId == req.CustomerId &&
                x.GameTypeId == req.GameTypeId &&
                x.DateUtc == dateUtcAnchor
            );

            if (daily == null)
            {
                daily = new DailyWinLoss
                {
                    CustomerId = req.CustomerId,
                    GameTypeId = req.GameTypeId,
                    DateUtc = dateUtcAnchor,
                    Total = netLoss,
                    NetLoss = netLoss
                };
                _db.DailyWinLosses.Add(daily);
            }
            else
            {
                daily.Total = decimal.Round(daily.Total + netLoss, 4);
                daily.NetLoss = decimal.Round(daily.NetLoss + netLoss, 4);
            }

            await WriteAudit("CREATE", "WinLoss", new
            {
                wl.CustomerId,
                wl.GameTypeId,
                wl.WinAmount,
                wl.LossAmount,
                wl.DateUtc,
                netLoss,
                dailyWinLossId = daily.Id
            });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            var tz = GetPngTimeZone();
            var pngDate = TimeZoneInfo.ConvertTimeFromUtc(dateUtcAnchor, tz).Date;

            return Ok(new
            {
                wl.Id,
                wl.CustomerId,
                wl.GameTypeId,
                wl.WinAmount,
                wl.LossAmount,
                datePng = pngDate.ToString("yyyy-MM-dd"),
                dateUtcAnchor,
                dailyWinLossId = daily.Id,
                netLoss
            });
        }

        // ✅ EDIT with audit + correct DailyWinLoss adjustments
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

            var oldNet = NetLoss(wl.WinAmount, wl.LossAmount);
            var oldAnchor = DateTime.SpecifyKind(wl.DateUtc, DateTimeKind.Utc);

            var utcMoment = EnsureUtc(req.DateUtc);
            var newAnchor = ToPngBusinessUtcAnchor(utcMoment);
            var newNet = NetLoss(req.WinAmount, req.LossAmount);

            using var tx = await _db.Database.BeginTransactionAsync();

            // 1) subtract from old Daily
            var oldDaily = await _db.DailyWinLosses.FirstOrDefaultAsync(x =>
                x.CustomerId == wl.CustomerId &&
                x.GameTypeId == wl.GameTypeId &&
                x.DateUtc == oldAnchor
            );

            if (oldDaily != null)
            {
                oldDaily.Total = decimal.Round(oldDaily.Total - oldNet, 4);
                oldDaily.NetLoss = decimal.Round(oldDaily.NetLoss - oldNet, 4);
                if (oldDaily.Total < 0) oldDaily.Total = 0;
                if (oldDaily.NetLoss < 0) oldDaily.NetLoss = 0;
            }

            // 2) apply changes to WinLoss
            wl.CustomerId = req.CustomerId;
            wl.GameTypeId = req.GameTypeId;
            wl.WinAmount = decimal.Round(req.WinAmount, 4);
            wl.LossAmount = decimal.Round(req.LossAmount, 4);
            wl.DateUtc = newAnchor;

            // 3) add to new Daily
            var newDaily = await _db.DailyWinLosses.FirstOrDefaultAsync(x =>
                x.CustomerId == wl.CustomerId &&
                x.GameTypeId == wl.GameTypeId &&
                x.DateUtc == newAnchor
            );

            if (newDaily == null)
            {
                newDaily = new DailyWinLoss
                {
                    CustomerId = wl.CustomerId,
                    GameTypeId = wl.GameTypeId,
                    DateUtc = newAnchor,
                    Total = newNet,
                    NetLoss = newNet
                };
                _db.DailyWinLosses.Add(newDaily);
            }
            else
            {
                newDaily.Total = decimal.Round(newDaily.Total + newNet, 4);
                newDaily.NetLoss = decimal.Round(newDaily.NetLoss + newNet, 4);
            }

            var after = new
            {
                wl.Id,
                wl.CustomerId,
                wl.GameTypeId,
                wl.WinAmount,
                wl.LossAmount,
                wl.DateUtc
            };

            await WriteAudit("EDIT", "WinLoss", new
            {
                before,
                after,
                oldNetLoss = oldNet,
                newNetLoss = newNet,
                oldDailyId = oldDaily?.Id,
                newDailyId = newDaily.Id
            });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

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
