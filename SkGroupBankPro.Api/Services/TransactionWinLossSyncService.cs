using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Services;

public sealed class TransactionWinLossSyncService(
    IServiceScopeFactory scopeFactory,
    ILogger<TransactionWinLossSyncService> logger,
    IHubContext<DashboardHub> hub
) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    private static TimeZoneInfo GetPngTimeZone()
    {
        var id = OperatingSystem.IsWindows()
            ? "West Pacific Standard Time"
            : "Pacific/Port_Moresby";
        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncTodayAndYesterday(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Tx→DailyWinLoss sync failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task SyncTodayAndYesterday(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tz = GetPngTimeZone();
        var nowPng = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;

        var dates = new[] { nowPng.AddDays(-1), nowPng };

        int upserted = 0;

        foreach (var pngDate in dates)
        {
            var (startUtc, endUtc) = PngDateToUtcRange(pngDate, tz);
            var dateUtcAnchor = PngMidnightToUtcAnchor(pngDate, tz);

            // ✅ Only APPROVED tx affects rebates
            var txs = await db.WalletTransactions
                .AsNoTracking()
                .Where(t =>
                    t.CreatedAtUtc >= startUtc && t.CreatedAtUtc < endUtc &&
                    t.Status == TxStatus.Approved &&
                    (t.Type == TxType.Deposit || t.Type == TxType.Withdrawal)
                )
                .Select(t => new
                {
                    t.CustomerId,
                    t.GameTypeId,
                    t.Type,
                    t.Amount
                })
                .ToListAsync(ct);

            // Group by customer + game
            var grouped = txs
                .Where(x => x.GameTypeId != null) // IMPORTANT: requires game type
                .GroupBy(x => new { x.CustomerId, GameTypeId = x.GameTypeId!.Value })
                .Select(g =>
                {
                    var deposits = g.Where(x => x.Type == TxType.Deposit).Sum(x => x.Amount);
                    var withdraws = g.Where(x => x.Type == TxType.Withdrawal).Sum(x => x.Amount);

                    var loss = decimal.Round(deposits, 4);
                    var win = decimal.Round(withdraws, 4);

                    var netLoss = loss - win;
                    if (netLoss < 0) netLoss = 0;
                    netLoss = decimal.Round(netLoss, 4);

                    return new { g.Key.CustomerId, g.Key.GameTypeId, NetLoss = netLoss };
                })
                .ToList();

            foreach (var row in grouped)
            {
                var daily = await db.DailyWinLosses.FirstOrDefaultAsync(d =>
                    d.CustomerId == row.CustomerId &&
                    d.GameTypeId == row.GameTypeId &&
                    d.DateUtc == dateUtcAnchor, ct);

                if (daily == null)
                {
                    daily = new DailyWinLoss
                    {
                        CustomerId = row.CustomerId,
                        GameTypeId = row.GameTypeId,
                        DateUtc = dateUtcAnchor,
                        Total = row.NetLoss,
                        NetLoss = row.NetLoss
                    };
                    db.DailyWinLosses.Add(daily);
                }
                else
                {
                    daily.Total = row.NetLoss;
                    daily.NetLoss = row.NetLoss;
                }

                upserted++;
            }

            await db.SaveChangesAsync(ct);
        }

        if (upserted > 0)
        {
            await hub.Clients.All.SendAsync("RebatesUpdated", new { source = "tx-sync", upserted }, ct);
            await hub.Clients.All.SendAsync("DashboardUpdated", new { source = "tx-sync", upserted }, ct);
        }

        logger.LogInformation("Tx→DailyWinLoss sync done. Upserted={Upserted}", upserted);
    }

    private static (DateTime startUtc, DateTime endUtc) PngDateToUtcRange(DateTime pngDate, TimeZoneInfo tz)
    {
        var startPng = DateTime.SpecifyKind(pngDate.Date, DateTimeKind.Unspecified);
        var endPng = DateTime.SpecifyKind(pngDate.Date.AddDays(1), DateTimeKind.Unspecified);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startPng, tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(endPng, tz);

        return (DateTime.SpecifyKind(startUtc, DateTimeKind.Utc), DateTime.SpecifyKind(endUtc, DateTimeKind.Utc));
    }

    private static DateTime PngMidnightToUtcAnchor(DateTime pngDate, TimeZoneInfo tz)
    {
        var pngMidnight = DateTime.SpecifyKind(pngDate.Date, DateTimeKind.Unspecified);
        var utc = TimeZoneInfo.ConvertTimeToUtc(pngMidnight, tz);
        return DateTime.SpecifyKind(utc, DateTimeKind.Utc);
    }
}
