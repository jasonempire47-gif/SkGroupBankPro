using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "Admin,Finance,Staff")]
public sealed class AuditLogsController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    // GET /api/audit-logs?take=100
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 100)
    {
        take = Math.Clamp(take, 1, 500);

        var rows = await _db.AuditLogs
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.Action,
                x.Entity,
                x.UserId,
                x.IpAddress,
                x.DetailsJson,
                x.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(rows);
    }
}
