using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Services;

public sealed class DailyRebateHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DailyRebateHostedService> _logger;

    private const decimal RebateRate = RebateSettings.RebateRate; // ✅ 0.05

    public DailyRebateHostedService(IServiceScopeFactory scopeFactory, ILogger<DailyRebateHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var pngTz = GetPngTimeZone();
                var nowPng = TimeZoneInfo.ConvertTime(DateTime.UtcNow, pngTz);

                // Next run: 00:05 PNG (tomorrow)
                var nextRunPng = new DateTime(nowPng.Year, nowPng.Month, nowPng.Day, 0, 5, 0).AddDays(1);
                var delay = nextRunPng - nowPng;
                if (delay < TimeSpan.FromSeconds(5)) delay = TimeSpan.FromSeconds(5);

                _logger.LogInformation("[RebateAuto] Now PNG={Now} NextRun PNG={Next} Delay={Delay}",
                    nowPng, nextRunPng, delay);

                await Task.Delay(delay, stoppingToken);

                // Process yesterday PNG day
                var businessDatePng = nextRunPng.Date.AddDays(-1);
                await CreateRebatesForPngDateAsync(businessDatePng, stoppingToken);
            }
            catch (TaskCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RebateAuto] Error. Retrying in 60s.");
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
            }
        }
    }

    private async Task CreateRebatesForPngDateAsync(DateTime businessDatePng, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pngTz = GetPngTimeZone();
        var (startUtc, endUtc) = PngDayToUtcRange(businessDatePng, pngTz);

        var rows = await db.DailyWinLosses
            .AsNoTracking()
            .Where(d => d.DateUtc >= startUtc && d.DateUtc < endUtc)
            .ToListAsync(ct);

        if (rows.Count == 0) return;

        foreach (var d in rows)
        {
            if (d.NetLoss <= 0) continue;

            var rebate = decimal.Round(d.NetLoss * RebateRate, 4);
            if (rebate <= 0) continue;

            var refNo = $"REBATE:{businessDatePng:yyyy-MM-dd}:C{d.CustomerId}:G{d.GameTypeId}";
            var exists = await db.WalletTransactions.AnyAsync(t => t.Type == TxType.Rebate && t.ReferenceNo == refNo, ct);
            if (exists) continue;

            db.WalletTransactions.Add(new WalletTransaction
            {
                CustomerId = d.CustomerId,
                GameTypeId = d.GameTypeId,
                Type = TxType.Rebate,
                Direction = TxDirection.Credit,
                Status = TxStatus.Pending,
                Amount = rebate,
                BankType = "REBATE",
                ReferenceNo = refNo,
                Notes = $"AUTO REBATE 5% | NetLoss={d.NetLoss:0.####} | PNG={businessDatePng:yyyy-MM-dd}",
                CreatedByUserId = null,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static (DateTime startUtc, DateTime endUtc) PngDayToUtcRange(DateTime pngDate, TimeZoneInfo pngTz)
    {
        var startPng = pngDate.Date;
        var endPng = startPng.AddDays(1);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startPng, pngTz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(endPng, pngTz);

        return (startUtc, endUtc);
    }

    private static TimeZoneInfo GetPngTimeZone()
    {
        var id = OperatingSystem.IsWindows()
            ? "West Pacific Standard Time"
            : "Pacific/Port_Moresby";

        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }
}
