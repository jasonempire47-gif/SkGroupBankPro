using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/events")]
public sealed class EventsLiveStateController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<LiveEventsHub> _hub;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public EventsLiveStateController(AppDbContext db, IHubContext<LiveEventsHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    // ✅ TV / audience devices can load without login
    [HttpGet("live-state")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLiveState()
    {
        var row = await _db.LiveEventStates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == 1);
        if (row == null) return Ok(new { state = new { } });

        object? obj;
        try
        {
            obj = JsonSerializer.Deserialize<object>(row.Json, JsonOpts) ?? new { };
        }
        catch
        {
            obj = new { };
        }

        return Ok(new { state = obj });
    }

    // ✅ Staff saves (requires login)
    [HttpPost("live-state")]
    [Authorize] // optionally: [Authorize(Roles="Admin,Staff,Finance")]
    public async Task<IActionResult> SaveLiveState([FromBody] JsonElement body)
    {
        var json = body.GetRawText();

        var row = await _db.LiveEventStates.FirstOrDefaultAsync(x => x.Id == 1);
        if (row == null)
        {
            row = new LiveEventState { Id = 1, Json = json, UpdatedAtUtc = DateTime.UtcNow };
            _db.LiveEventStates.Add(row);
        }
        else
        {
            row.Json = json;
            row.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // broadcast to all preview clients
        object payload;
        try
        {
            payload = JsonSerializer.Deserialize<object>(json, JsonOpts) ?? new { };
        }
        catch
        {
            payload = new { };
        }

        await _hub.Clients.All.SendAsync("liveStateUpdated", payload);

        return Ok(new { ok = true });
    }
}
