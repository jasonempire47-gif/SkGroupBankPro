using System;

namespace SkGroupBankpro.Api.Models;

public sealed class LiveEventState
{
    public int Id { get; set; } = 1;         // single-row table
    public string Json { get; set; } = "{}"; // stores the full state JSON
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
