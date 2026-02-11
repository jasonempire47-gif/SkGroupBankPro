using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/rebates")]
[Authorize(Roles = "Admin,Finance,Staff")]
public sealed class RebatesController(AppDbContext db, IHubContext<DashboardHub> hub) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IHubContext<DashboardHub> _hub = hub;

    private const decimal RebateRate = 0.05m;

    private static TimeZoneInfo GetPngTimeZone()
    {
        var id = OperatingSystem.IsWindows()
            ? "West Pacific Standard Time"
            : "Pacific/Port_Moresby";
        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    private static (DateTime startUtc, DateTime endUtc) PngDateToUtcRange(DateTime pngDate)
    {
        var tz = GetPngTimeZone();
        var startPng = pngDate.Date;
        var endPng = startPng.AddDays(1);

        return (TimeZoneInfo.ConvertTimeToUtc(startPng, tz),
                TimeZoneInfo.ConvertTimeToUtc(endPng, tz));
    }

    private static DateTime UtcToPngDate(DateTime utc)
    {
        var tz = GetPngTimeZone();
        var png = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
        return png.Date;
    }

    [HttpPost("run")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public async Task<IActionResult> Run([FromQuery] DateTime businessDate)
    {
        var (startUtc, endUtc) = PngDateToUtcRange(businessDate);

        var rows = await _db.DailyWinLosses
            .AsNoTracking()
            .Where(d => d.DateUtc >= startUtc && d.DateUtc < endUtc)
            .ToListAsync();

        int created = 0, skipped = 0;

        foreach (var d in rows)
        {
            if (d.NetLoss <= 0) { skipped++; continue; }

            var rebate = decimal.Round(d.NetLoss * RebateRate, 4);
            if (rebate <= 0) { skipped++; continue; }

            var refNo = $"REBATE:{businessDate:yyyy-MM-dd}:C{d.CustomerId}:G{d.GameTypeId}";
            var exists = await _db.WalletTransactions.AnyAsync(t => t.Type == TxType.Rebate && t.ReferenceNo == refNo);
            if (exists) { skipped++; continue; }

            _db.WalletTransactions.Add(new WalletTransaction
            {
                CustomerId = d.CustomerId,
                GameTypeId = d.GameTypeId,
                Amount = rebate,
                Type = TxType.Rebate,
                Direction = TxDirection.Credit,
                Status = TxStatus.Pending,
                BankType = "REBATE",
                ReferenceNo = refNo,
                Notes = $"MANUAL RUN REBATE 5% | NetLoss={d.NetLoss:0.####} | PNG={businessDate:yyyy-MM-dd}",
                CreatedAtUtc = DateTime.UtcNow
            });

            created++;
        }

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("RebatesUpdated", new { entity = "rebate", action = "run", date = businessDate.ToString("yyyy-MM-dd") });
        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "rebate", action = "run", date = businessDate.ToString("yyyy-MM-dd") });

        return Ok(new { businessDate = businessDate.ToString("yyyy-MM-dd"), created, skipped, rate = "5%" });
    }

    [HttpGet("report")]
    public async Task<IActionResult> Report([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (to < from) return BadRequest("to must be >= from");

        var tz = GetPngTimeZone();
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(from.Date, tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(to.Date.AddDays(1), tz);

        var data = await (
            from d in _db.DailyWinLosses.AsNoTracking()
            join c in _db.Customers.AsNoTracking() on d.CustomerId equals c.Id
            join g in _db.GameTypes.AsNoTracking() on d.GameTypeId equals g.Id
            where d.DateUtc >= startUtc && d.DateUtc < endUtc
            orderby d.DateUtc descending, c.Name, g.Name
            select new
            {
                customerId = d.CustomerId,
                customerName = c.Name,
                gameTypeId = d.GameTypeId,
                gameTypeName = g.Name,
                netLoss = d.NetLoss,

                expectedRebate = d.NetLoss > 0 ? decimal.Round(d.NetLoss * RebateRate, 4) : 0m,
                rebate = d.NetLoss > 0 ? decimal.Round(d.NetLoss * RebateRate, 4) : 0m,

                rate = "5%",
                rateValue = RebateRate,
                ratePercent = RebateRate * 100m,
                dateUtc = d.DateUtc,

                businessDatePng = UtcToPngDate(d.DateUtc).ToString("yyyy-MM-dd"),
                datePng = UtcToPngDate(d.DateUtc).ToString("yyyy-MM-dd")
            }
        ).ToListAsync();

        return Ok(data);
    }

    [HttpPatch("{id:int}/approve")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public async Task<IActionResult> Approve(int id)
    {
        var tx = await _db.WalletTransactions.FirstOrDefaultAsync(x => x.Id == id && x.Type == TxType.Rebate);
        if (tx == null) return NotFound("Rebate transaction not found.");

        if (tx.Status == TxStatus.Approved) return Ok(tx);
        if (tx.Status == TxStatus.Rejected) return BadRequest("Already rejected.");

        tx.Status = TxStatus.Approved;
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("RebatesUpdated", new { entity = "rebate", action = "approved", id });
        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "rebate", action = "approved", id });

        return Ok(tx);
    }

    [HttpPatch("{id:int}/reject")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectReq? req)
    {
        var tx = await _db.WalletTransactions.FirstOrDefaultAsync(x => x.Id == id && x.Type == TxType.Rebate);
        if (tx == null) return NotFound("Rebate transaction not found.");

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

        await _hub.Clients.All.SendAsync("RebatesUpdated", new { entity = "rebate", action = "rejected", id });
        await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "rebate", action = "rejected", id });

        return Ok(tx);
    }

    public sealed class RejectReq
    {
        public string? Reason { get; set; }
    }
}
