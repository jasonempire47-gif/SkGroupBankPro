// Controllers/TransactionQueryController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/transactions")]
[Authorize]
public sealed class TransactionQueryController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    private static TimeZoneInfo GetPngTimeZone()
    {
        var id = OperatingSystem.IsWindows()
            ? "West Pacific Standard Time"
            : "Pacific/Port_Moresby";

        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    private static string ToIsoZ(DateTime utc)
    {
        var u = utc.Kind == DateTimeKind.Utc ? utc : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return u.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
    }

    private static string ToPngString(DateTime utc, TimeZoneInfo pngTz)
    {
        var u = utc.Kind == DateTimeKind.Utc ? utc : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        var png = TimeZoneInfo.ConvertTimeFromUtc(u, pngTz);
        return png.ToString("yyyy-MM-dd HH:mm:ss");
    }

    /// <summary>
    /// ✅ Backward-compatible endpoint for UI scripts that call:
    /// GET /api/transactions?take=200&q=
    ///
    /// Returns a plain list (NOT paginated object).
    /// This is what your rebates.js expects.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetTake(
        [FromQuery] int take = 100,
        [FromQuery] string? q = null)
    {
        take = take < 1 ? 100 : Math.Min(take, 500);

        var pngTz = GetPngTimeZone();

        var query = _db.WalletTransactions
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.GameType)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();

            query = query.Where(x =>
                (x.Customer != null && x.Customer.Name.ToLower().Contains(s)) ||
                x.Type.ToString().ToLower().Contains(s) ||
                x.Status.ToString().ToLower().Contains(s) ||
                (x.BankType != null && x.BankType.ToLower().Contains(s)) ||
                (x.ReferenceNo != null && x.ReferenceNo.ToLower().Contains(s)) ||
                (x.Notes != null && x.Notes.ToLower().Contains(s)) ||
                (x.GameType != null && x.GameType.Name.ToLower().Contains(s))
            );
        }

        // newest first
        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer != null ? x.Customer.Name : "N/A",

                type = (int)x.Type,
                typeName = x.Type.ToString(),

                status = (int)x.Status,
                statusName = x.Status.ToString(),

                amount = x.Amount,

                bankType = x.BankType ?? "",
                referenceNo = x.ReferenceNo ?? "",
                notes = x.Notes ?? "",

                gameTypeId = x.GameTypeId,
                gameTypeName = x.GameType != null ? x.GameType.Name : "-",

                createdAtUtc = ToIsoZ(x.CreatedAtUtc),
                createdAtPng = ToPngString(x.CreatedAtUtc, pngTz)
            })
            .ToListAsync();

        // ✅ Returns array (rebates.js expects array)
        return Ok(items);
    }

    /// <summary>
    /// Paginated list for dashboard UI:
    /// GET /api/transactions/all?page=1&pageSize=25&q=
    /// Returns { page, pageSize, total, items }
    /// </summary>
    [HttpGet("all")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? q = null)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 25 : Math.Min(pageSize, 200);

        var pngTz = GetPngTimeZone();

        var query = _db.WalletTransactions
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.GameType)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();

            query = query.Where(x =>
                (x.Customer != null && x.Customer.Name.ToLower().Contains(s)) ||
                x.Type.ToString().ToLower().Contains(s) ||
                x.Status.ToString().ToLower().Contains(s) ||
                (x.BankType != null && x.BankType.ToLower().Contains(s)) ||
                (x.ReferenceNo != null && x.ReferenceNo.ToLower().Contains(s)) ||
                (x.Notes != null && x.Notes.ToLower().Contains(s)) ||
                (x.GameType != null && x.GameType.Name.ToLower().Contains(s))
            );
        }

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer != null ? x.Customer.Name : "N/A",

                type = (int)x.Type,
                typeName = x.Type.ToString(),

                status = (int)x.Status,
                statusName = x.Status.ToString(),

                amount = x.Amount,

                bankType = x.BankType ?? "",
                referenceNo = x.ReferenceNo ?? "",
                notes = x.Notes ?? "",

                gameTypeId = x.GameTypeId,
                gameTypeName = x.GameType != null ? x.GameType.Name : "-",

                createdAtUtc = ToIsoZ(x.CreatedAtUtc),
                createdAtPng = ToPngString(x.CreatedAtUtc, pngTz)
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            total,
            items
        });
    }
}
