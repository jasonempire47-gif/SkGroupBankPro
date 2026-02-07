using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Services;

public sealed class AutoRebateService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<DashboardHub> _hub;

    // 5% default – keep same as your UI
    private const decimal RebateRate = 0.05m;

    public AutoRebateService(IServiceScopeFactory scopeFactory, IHubContext<DashboardHub> hub)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
    }

    private static TimeZoneInfo GetPngTimeZone()
    {
        var id = OperatingSystem.IsWindows()
            ? "West Pacific Standard Time"
            : "Pacific/Port_Moresby";

        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    private static DateTime PngDateToUtcAnchor(DateOnly pngDate)
    {
        // PNG midnight -> UTC
        var tz = GetPngTimeZone();
        var pngMidnight = new DateTime(pngDate.Year, pngDate.Month, pngDate.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var utc = TimeZoneInfo.ConvertTimeToUtc(pngMidnight, tz);
        return DateTime.SpecifyKind(utc, DateTimeKind.Utc);
    }

    private static DateTime GetNextPngMidnightUtc(DateTime utcNow)
    {
        var tz = GetPngTimeZone();
        var pngNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);

        var nextMidnightPng = pngNow.Date.AddDays(1);
        var nextMidnightLocal = new DateTime(nextMidnightPng.Year, nextMidnightPng.Month, nextMidnightPng.Day, 0, 0, 0, DateTimeKind.Unspecified);

        var nextUtc = TimeZoneInfo.ConvertTimeToUtc(nextMidnightLocal, tz);
        return DateTime.SpecifyKind(nextUtc, DateTimeKind.Utc);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // loop forever
        while (!stoppingToken.IsCancellationRequested)
        {
            var utcNow = DateTime.UtcNow;
            var nextRunUtc = GetNextPngMidnightUtc(utcNow);
            var delay = nextRunUtc - utcNow;
            if (delay < TimeSpan.FromSeconds(1)) delay = TimeSpan.FromSeconds(1);

            await Task.Delay(delay, stoppingToken);

            // process “yesterday” PNG date (the day that just ended)
            // At 00:00 PNG, the “business date to rebate” is previous day
            var tz = GetPngTimeZone();
            var pngNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            var businessDate = DateOnly.FromDateTime(pngNow.Date.AddDays(-1));

            try
            {
                await RunAutoRebatesForDate(businessDate, stoppingToken);
            }
            catch
            {
                // don’t crash service; you can add logging if you want
            }
        }
    }

    private async Task RunAutoRebatesForDate(DateOnly businessDatePng, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var dateUtcAnchor = PngDateToUtcAnchor(businessDatePng);

        // Pull all DailyWinLoss rows for this date anchor with netloss > 0
        var rows = await db.DailyWinLosses
            .AsNoTracking()
            .Where(x => x.DateUtc == dateUtcAnchor && x.NetLoss > 0)
            .Select(x => new { x.CustomerId, x.GameTypeId, x.NetLoss })
            .ToListAsync(ct);

        if (rows.Count == 0) return;

        // Build a deterministic ReferenceNo so we can detect duplicates.
        // One rebate per Customer+Game+Date
        // e.g. REB-20260205-C1-G2
        string Ref(int custId, int gameId) =>
            $"REB-{businessDatePng:yyyyMMdd}-C{custId}-G{gameId}";

        // Load existing rebate transactions for that date and prefix
        var prefix = $"REB-{businessDatePng:yyyyMMdd}-";
        var existing = await db.WalletTransactions
            .Where(t => t.Type == TxType.Rebate && t.ReferenceNo.StartsWith(prefix))
            .Select(t => new { t.Id, t.ReferenceNo })
            .ToListAsync(ct);

        var existingSet = existing.ToDictionary(x => x.ReferenceNo, x => x.Id);

        // Create new approved rebate txs
        foreach (var r in rows)
        {
            var reference = Ref(r.CustomerId, r.GameTypeId);
            if (existingSet.ContainsKey(reference))
                continue; // already created

            var rebateAmount = decimal.Round(r.NetLoss * RebateRate, 4);
            if (rebateAmount <= 0) continue;

            db.WalletTransactions.Add(new WalletTransaction
            {
                CustomerId = r.CustomerId,
                GameTypeId = r.GameTypeId,
                Type = TxType.Rebate,
                Direction = TxDirection.Credit,
                Status = TxStatus.Approved, // ✅ auto-approved
                Amount = rebateAmount,

                BankType = "SYSTEM",
                ReferenceNo = reference,
                Notes = $"AUTO REBATE {RebateRate:P0} for {businessDatePng:yyyy-MM-dd} (PNG)",

                CreatedByUserId = 0, // system
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        var created = await db.SaveChangesAsync(ct);
        if (created > 0)
        {
            await _hub.Clients.All.SendAsync("DashboardUpdated",
                new { entity = "rebates", action = "auto-created-approved", businessDate = businessDatePng.ToString("yyyy-MM-dd") },
                ct);
        }
    }
}
