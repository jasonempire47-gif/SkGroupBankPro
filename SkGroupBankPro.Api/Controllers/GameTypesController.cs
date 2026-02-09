using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/gametypes")]
[Authorize]
public sealed class GameTypesController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var rows = await _db.GameTypes
            .OrderBy(x => x.Name)
            .ToListAsync();

        return Ok(rows);
    }

    public sealed class CreateGameTypeRequest
    {
        public string Name { get; set; } = "";
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGameTypeRequest req)
    {
        var name = (req?.Name ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("Game name is required.");

        var exists = await _db.GameTypes.AnyAsync(x => x.Name.ToLower() == name.ToLower());
        if (exists) return BadRequest("Game already exists.");

        var g = new GameType
        {
            Name = name,
            IsEnabled = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.GameTypes.Add(g);
        await _db.SaveChangesAsync();

        return Ok(g);
    }

    // ✅ NEW: Rename + Enable/Disable
    public sealed class UpdateGameTypeRequest
    {
        public string? Name { get; set; }
        public bool? IsEnabled { get; set; }
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "Admin,Finance")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateGameTypeRequest req)
    {
        var g = await _db.GameTypes.FirstOrDefaultAsync(x => x.Id == id);
        if (g == null) return NotFound("Game not found.");

        var name = (req?.Name ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(name) && !name.Equals(g.Name, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await _db.GameTypes.AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower());
            if (exists) return BadRequest("Game already exists.");
            g.Name = name;
        }

        if (req?.IsEnabled.HasValue == true)
            g.IsEnabled = req.IsEnabled.Value;

        await _db.SaveChangesAsync();
        return Ok(g);
    }
}
