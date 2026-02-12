using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Dtos;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/events")]
public sealed class EventsController(EventsDbContext db) : ControllerBase
{
    private readonly EventsDbContext _db = db;

    // ======================
    // PUBLIC (Live Preview)
    // ======================

    // ✅ Public so CustomerLivePreview works without token
    [AllowAnonymous]
    [HttpGet("prizes")]
    public async Task<IActionResult> GetPrizes(CancellationToken ct)
    {
        var rows = await _db.EventPrizes
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Id)
            .Select(x => new PrizeDto(x.Id, x.Label, x.Type, x.Value, x.Currency, x.IsEnabled, x.SortOrder))
            .ToListAsync(ct);

        return Ok(rows);
    }

    // ✅ Public so CustomerLivePreview can read the latest winner
    [AllowAnonymous]
    [HttpGet("spins/recent")]
    public async Task<IActionResult> RecentSpins([FromQuery] int take = 50, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);

        var rows = await _db.EventSpinResults
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.CustomerNameSnapshot,
                x.PrizeLabelSnapshot,
                x.PrizeTypeSnapshot,
                x.PrizeValueSnapshot,
                x.CurrencySnapshot,
                x.SpunBy,
                x.CreatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    // ======================
    // STAFF (Admin/Staff)
    // ======================

    [Authorize(Roles = "Admin,Staff")]
    [HttpPost("prizes")]
    public async Task<IActionResult> UpsertPrize([FromBody] UpsertPrizeRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Label)) return BadRequest("Label is required.");
        if (string.IsNullOrWhiteSpace(req.Currency)) return BadRequest("Currency is required.");

        EventPrize p;
        if (req.Id.HasValue)
        {
            p = await _db.EventPrizes.FirstOrDefaultAsync(x => x.Id == req.Id.Value, ct);
            if (p is null) return NotFound("Prize not found.");
        }
        else
        {
            p = new EventPrize();
            _db.EventPrizes.Add(p);
        }

        p.Label = req.Label.Trim();
        p.Type = req.Type;
        p.Value = req.Value;
        p.Currency = req.Currency.Trim().ToUpperInvariant();
        p.IsEnabled = req.IsEnabled;
        p.SortOrder = req.SortOrder;
        p.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new PrizeDto(p.Id, p.Label, p.Type, p.Value, p.Currency, p.IsEnabled, p.SortOrder));
    }

    [Authorize(Roles = "Admin,Staff")]
    [HttpDelete("prizes/{id:int}")]
    public async Task<IActionResult> DeletePrize(int id, CancellationToken ct)
    {
        var p = await _db.EventPrizes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();

        _db.EventPrizes.Remove(p);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    // ---------- SPIN (manual selection) ----------
    [Authorize(Roles = "Admin,Staff")]
    [HttpPost("spin")]
    public async Task<ActionResult<SpinResultDto>> Spin([FromBody] SpinRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.CustomerName)) return BadRequest("CustomerName is required.");
        if (string.IsNullOrWhiteSpace(req.SpunBy)) return BadRequest("SpunBy is required.");

        var prize = await _db.EventPrizes.FirstOrDefaultAsync(x => x.Id == req.PrizeId, ct);
        if (prize is null) return NotFound("Prize not found.");
        if (!prize.IsEnabled) return BadRequest("Prize is disabled.");

        // Separate customer (NOT the main system customer)
        var customer = new EventCustomer
        {
            Name = req.CustomerName.Trim(),
            Reference = string.IsNullOrWhiteSpace(req.CustomerReference) ? null : req.CustomerReference.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };
        _db.EventCustomers.Add(customer);
        await _db.SaveChangesAsync(ct);

        var spin = new EventSpinResult
        {
            EventCustomerId = customer.Id,
            EventPrizeId = prize.Id,
            CustomerNameSnapshot = customer.Name,
            CustomerReferenceSnapshot = customer.Reference,
            PrizeLabelSnapshot = prize.Label,
            PrizeTypeSnapshot = prize.Type,
            PrizeValueSnapshot = prize.Value,
            CurrencySnapshot = prize.Currency,
            SpunBy = req.SpunBy.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.EventSpinResults.Add(spin);
        await _db.SaveChangesAsync(ct);

        return Ok(new SpinResultDto(
            spin.Id,
            customer.Name,
            customer.Reference,
            prize.Id,
            prize.Label,
            prize.Type,
            prize.Value,
            prize.Currency,
            spin.SpunBy,
            spin.CreatedAtUtc
        ));
    }
}
