using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/daily-winloss")]
[Authorize]
public sealed class DailyWinLossController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    private static TimeZoneInfo GetPngTimeZone()
    {
        return OperatingSystem.IsWindows()
            ? TimeZoneInfo.FindSystemTimeZoneById("West Pacific Standard Time")
            : TimeZoneInfo.FindSystemTimeZoneById("Pacific/Port_Moresby");
    }

    // PNG business date -> UTC anchor (PNG midnight converted to UTC)
    private static DateTime PngDateToUtcAnchor(DateOnly pngDate)
    {
        var tz = GetPngTimeZone();

        var localMidnight = new DateTime(
            pngDate.Year, pngDate.Month, pngDate.Day,
            0, 0, 0,
            DateTimeKind.Unspecified
        );

        var utc = TimeZoneInfo.ConvertTimeToUtc(localMidnight, tz);
        return DateTime.SpecifyKind(utc, DateTimeKind.Utc);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 200)
    {
        take = Math.Clamp(take, 1, 500);

        var rows = await (
            from w in _db.DailyWinLosses.AsNoTracking()
            join c in _db.Customers.AsNoTracking() on w.CustomerId equals c.Id
            join g in _db.GameTypes.AsNoTracking() on w.GameTypeId equals g.Id
            orderby w.DateUtc descending, w.Id descending
            select new
            {
                w.Id,
                w.CustomerId,
                customerName = c.Name,
                w.GameTypeId,
                gameTypeName = g.Name,
                w.NetLoss,
                w.Total,
                dateUtc = w.DateUtc,
                businessDatePng = w.BusinessDatePng
            }
        ).Take(take).ToListAsync();

        return Ok(rows);
    }

    // ✅ Hide manual daily endpoint from Swagger (you should use /api/winloss)
    // ✅ Still exists for internal/admin maintenance only
    [HttpPost]
    [ApiExplorerSettings(IgnoreApi = true)]
    [Authorize(Roles = "Admin,Finance")]
    public async Task<IActionResult> Upsert([FromBody] CreateDailyWinLossRequest req)
    {
        if (req.CustomerId <= 0) return BadRequest("CustomerId required.");
        if (req.GameTypeId <= 0) return BadRequest("GameTypeId required.");
        if (req.WinAmount < 0) return BadRequest("WinAmount must be >= 0.");
        if (req.LossAmount < 0) return BadRequest("LossAmount must be >= 0.");

        // ✅ Reject default/invalid business date
        if (req.BusinessDatePng == default || req.BusinessDatePng.Year < 2000)
            return BadRequest("BusinessDatePng is required and must be a valid PNG date (>= year 2000). Use POST /api/winloss instead.");

        var dateUtc = PngDateToUtcAnchor(req.BusinessDatePng);

        // ✅ Rebate logic: only positive customer LOSS counts
        var netLoss = Math.Max(0, decimal.Round(req.LossAmount - req.WinAmount, 4));

        var row = await _db.DailyWinLosses.FirstOrDefaultAsync(x =>
            x.CustomerId == req.CustomerId &&
            x.GameTypeId == req.GameTypeId &&
            x.DateUtc == dateUtc);

        if (row == null)
        {
            row = new DailyWinLoss
            {
                CustomerId = req.CustomerId,
                GameTypeId = req.GameTypeId,
                DateUtc = dateUtc
            };
            _db.DailyWinLosses.Add(row);
        }

        row.NetLoss = netLoss;
        row.Total = netLoss; // compatibility

        await _db.SaveChangesAsync();

        return Ok(new
        {
            row.Id,
            row.CustomerId,
            row.GameTypeId,
            row.NetLoss,
            row.Total,
            dateUtc = row.DateUtc,
            businessDatePng = row.BusinessDatePng
        });
    }

    public sealed class CreateDailyWinLossRequest
    {
        public int CustomerId { get; set; }
        public int GameTypeId { get; set; }
        public decimal WinAmount { get; set; }
        public decimal LossAmount { get; set; }
        public DateOnly BusinessDatePng { get; set; }
    }
}
