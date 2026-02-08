// Controllers/TransactionsQueryController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/transactions")]
[Authorize]
public sealed class TransactionsQueryController : ControllerBase
{
    private readonly AppDbContext _db;
    public TransactionsQueryController(AppDbContext db) => _db = db;

    // GET /api/transactions/all?page=1&pageSize=25&q=dave&status=pending
    [HttpGet("all")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? q = null,
        [FromQuery] string? status = null
    )
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 25 : pageSize;
        pageSize = Math.Min(pageSize, 200);

        var query = _db.WalletTransactions
            .AsNoTracking()
            .Include("Customer")
            .Include("GameType")
            .AsQueryable();

        // Search
        if (!string.IsNullOrWhiteSpace(q))
        {
            q = q.Trim();
            query = query.Where(x =>
                (EF.Property<object>(x, "Customer") != null &&
                 (EF.Property<string>(EF.Property<object>(x, "Customer"), "Name") ?? "").Contains(q))
                || (EF.Property<object>(x, "Type") != null && EF.Property<object>(x, "Type")!.ToString()!.Contains(q))
                || (EF.Property<object>(x, "Status") != null && EF.Property<object>(x, "Status")!.ToString()!.Contains(q))
                || (EF.Property<object>(x, "BankType") != null && EF.Property<object>(x, "BankType")!.ToString()!.Contains(q))
                || (EF.Property<string>(x, "ReferenceNo") ?? "").Contains(q)
                || (EF.Property<string>(x, "Notes") ?? "").Contains(q)
            );
        }

        // Status filter (Pending/Approved)
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLowerInvariant();
            if (s == "pending" || s == "approved")
            {
                query = query.Where(x =>
                    EF.Property<object>(x, "Status") != null &&
                    EF.Property<object>(x, "Status")!.ToString()!.ToLower() == s
                );
            }
        }

        // Use CreatedAtUtc if present else CreatedAt (your project uses CreatedAt most of the time)
        var dateField = typeof(WalletTransaction).GetProperty("CreatedAtUtc") != null ? "CreatedAtUtc" : "CreatedAt";

        var total = await query.CountAsync();

        query = query.OrderByDescending(x => EF.Property<DateTime>(x, dateField));

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                id = EF.Property<int>(x, "Id"),

                customerId = EF.Property<int?>(x, "CustomerId"),
                customerName = EF.Property<object>(x, "Customer") != null
                    ? (EF.Property<string>(EF.Property<object>(x, "Customer"), "Name") ?? "")
                    : "",

                typeName = EF.Property<object>(x, "Type") != null ? EF.Property<object>(x, "Type")!.ToString()! : "",

                gameTypeId = EF.Property<int?>(x, "GameTypeId"),
                gameTypeName = EF.Property<object>(x, "GameType") != null
                    ? (EF.Property<string>(EF.Property<object>(x, "GameType"), "Name") ?? "")
                    : "-",

                amount = EF.Property<decimal>(x, "Amount"),
                statusName = EF.Property<object>(x, "Status") != null ? EF.Property<object>(x, "Status")!.ToString()! : "",

                bankType = EF.Property<object>(x, "BankType") != null ? EF.Property<object>(x, "BankType")!.ToString()! : "",
                referenceNo = EF.Property<string>(x, "ReferenceNo"),
                notes = EF.Property<string>(x, "Notes"),

                createdAt = EF.Property<DateTime>(x, dateField)
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
