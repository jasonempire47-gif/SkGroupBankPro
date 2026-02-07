using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/admin-dashboard")]
[Authorize]
public sealed class AdminDashboardController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    private static TimeZoneInfo GetPngTimeZone()
    {
        var id = OperatingSystem.IsWindows()
            ? "West Pacific Standard Time"
            : "Pacific/Port_Moresby";

        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    private static (DateTime startUtc, DateTime endUtc, DateTime pngDate) GetPngDayUtcRange(DateTime? pngDate = null)
    {
        var pngTz = GetPngTimeZone();
        var nowPng = TimeZoneInfo.ConvertTime(DateTime.UtcNow, pngTz);
        var d = (pngDate ?? nowPng.Date).Date;

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(d, pngTz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(d.AddDays(1), pngTz);
        return (startUtc, endUtc, d);
    }

    private static (DateTime startUtc, DateTime endUtc) GetPngMonthToDateUtcRange()
    {
        var pngTz = GetPngTimeZone();
        var nowPng = TimeZoneInfo.ConvertTime(DateTime.UtcNow, pngTz);

        var monthStartPng = new DateTime(nowPng.Year, nowPng.Month, 1);
        var monthEndPng = nowPng.Date.AddDays(1);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(monthStartPng, pngTz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(monthEndPng, pngTz);

        return (startUtc, endUtc);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var (todayStartUtc, todayEndUtc, pngDate) = GetPngDayUtcRange();
        var (mtdStartUtc, mtdEndUtc) = GetPngMonthToDateUtcRange();

        var totalCustomers = await _db.Customers.AsNoTracking().CountAsync();
        var activeGames = await _db.GameTypes.AsNoTracking().CountAsync(g => g.IsEnabled);

        // Today approved
        var todayDepositsDbl = await _db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAtUtc >= todayStartUtc && t.CreatedAtUtc < todayEndUtc
                && t.Status == TxStatus.Approved && t.Type == TxType.Deposit)
            .Select(t => (double)t.Amount)
            .SumAsync();

        var todayWithdrawalsDbl = await _db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAtUtc >= todayStartUtc && t.CreatedAtUtc < todayEndUtc
                && t.Status == TxStatus.Approved && t.Type == TxType.Withdrawal)
            .Select(t => (double)t.Amount)
            .SumAsync();

        var todayRebatesApprovedDbl = await _db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAtUtc >= todayStartUtc && t.CreatedAtUtc < todayEndUtc
                && t.Status == TxStatus.Approved && t.Type == TxType.Rebate)
            .Select(t => (double)t.Amount)
            .SumAsync();

        // MTD approved
        var mtdDepositsDbl = await _db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAtUtc >= mtdStartUtc && t.CreatedAtUtc < mtdEndUtc
                && t.Status == TxStatus.Approved && t.Type == TxType.Deposit)
            .Select(t => (double)t.Amount)
            .SumAsync();

        var mtdWithdrawalsDbl = await _db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAtUtc >= mtdStartUtc && t.CreatedAtUtc < mtdEndUtc
                && t.Status == TxStatus.Approved && t.Type == TxType.Withdrawal)
            .Select(t => (double)t.Amount)
            .SumAsync();

        var todayDeposits = decimal.Round((decimal)todayDepositsDbl, 2);
        var todayWithdrawals = decimal.Round((decimal)todayWithdrawalsDbl, 2);
        var todayProfit = decimal.Round(todayDeposits - todayWithdrawals, 2);

        var mtdDeposits = decimal.Round((decimal)mtdDepositsDbl, 2);
        var mtdWithdrawals = decimal.Round((decimal)mtdWithdrawalsDbl, 2);
        var mtdProfit = decimal.Round(mtdDeposits - mtdWithdrawals, 2);

        // Pending counts
        var pendingDeposits = await _db.WalletTransactions.AsNoTracking()
            .CountAsync(t => t.Status == TxStatus.Pending && t.Type == TxType.Deposit);

        var pendingWithdrawals = await _db.WalletTransactions.AsNoTracking()
            .CountAsync(t => t.Status == TxStatus.Pending && t.Type == TxType.Withdrawal);

        var pendingRebates = await _db.WalletTransactions.AsNoTracking()
            .CountAsync(t => t.Status == TxStatus.Pending && t.Type == TxType.Rebate);

        var todayRebatesApproved = decimal.Round((decimal)todayRebatesApprovedDbl, 2);

        return Ok(new
        {
            pngDate = pngDate.ToString("yyyy-MM-dd"),
            totalCustomers,
            activeGames,

            todayDeposits,
            todayWithdrawals,
            todayProfit,
            todayRebatesApproved,

            mtdDeposits,
            mtdWithdrawals,
            mtdProfit,

            pendingDeposits,
            pendingWithdrawals,
            pendingRebates
        });
    }
}
