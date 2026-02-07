using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/game-types")]
[Authorize]
public sealed class GameTypesController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    // ✅ Public list (used by Staff/WinLoss dropdown)
    // GET /api/game-types
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var data = await _db.GameTypes
            .AsNoTracking()
            .Where(g => g.IsEnabled)
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                id = g.Id,
                name = g.Name,
                isEnabled = g.IsEnabled,
                createdAtUtc = g.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(data);
    }

    // ✅ Admin list (includes disabled)
    // GET /api/game-types/all
    [HttpGet("all")]
    [Authorize(Roles = "Admin,Finance,Staff")]
    public async Task<IActionResult> ListAll()
    {
        var data = await _db.GameTypes
            .AsNoTracking()
            .OrderByDescending(g => g.CreatedAtUtc)
            .ThenBy(g => g.Name)
            .Select(g => new
            {
                id = g.Id,
                name = g.Name,
                isEnabled = g.IsEnabled,
                createdAtUtc = g.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(data);
    }

    // ✅ Add new game type
    // POST /api/game-types
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateGameTypeRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");

        var exists = await _db.GameTypes.AnyAsync(g => g.Name.ToLower() == name.ToLower());
        if (exists) return BadRequest("Game type already exists.");

        var gt = new GameType
        {
            Name = name,
            IsEnabled = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.GameTypes.Add(gt);
        await _db.SaveChangesAsync();

        return Ok(new { id = gt.Id, name = gt.Name, isEnabled = gt.IsEnabled, createdAtUtc = gt.CreatedAtUtc });
    }

    // ✅ Enable
    // PATCH /api/game-types/{id}/enable
    [HttpPatch("{id:int}/enable")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Enable(int id)
    {
        var gt = await _db.GameTypes.FirstOrDefaultAsync(x => x.Id == id);
        if (gt == null) return NotFound("Game type not found.");

        gt.IsEnabled = true;
        await _db.SaveChangesAsync();
        return Ok(new { id = gt.Id, isEnabled = gt.IsEnabled });
    }

    // ✅ Disable
    // PATCH /api/game-types/{id}/disable
    [HttpPatch("{id:int}/disable")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Disable(int id)
    {
        var gt = await _db.GameTypes.FirstOrDefaultAsync(x => x.Id == id);
        if (gt == null) return NotFound("Game type not found.");

        gt.IsEnabled = false;
        await _db.SaveChangesAsync();
        return Ok(new { id = gt.Id, isEnabled = gt.IsEnabled });
    }

    // ✅ Rename
    // PATCH /api/game-types/{id}/rename
    [HttpPatch("{id:int}/rename")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Rename(int id, [FromBody] RenameGameTypeRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");

        var gt = await _db.GameTypes.FirstOrDefaultAsync(x => x.Id == id);
        if (gt == null) return NotFound("Game type not found.");

        var exists = await _db.GameTypes.AnyAsync(g => g.Id != id && g.Name.ToLower() == name.ToLower());
        if (exists) return BadRequest("Another game type already has that name.");

        gt.Name = name;
        await _db.SaveChangesAsync();

        return Ok(new { id = gt.Id, name = gt.Name });
    }

    public sealed class CreateGameTypeRequest
    {
        public string? Name { get; set; }
    }

    public sealed class RenameGameTypeRequest
    {
        public string? Name { get; set; }
    }
}
