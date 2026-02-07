using System.ComponentModel.DataAnnotations;

namespace SkGroupBankpro.Api.Models;

public sealed class AuditLog
{
    public int Id { get; set; }

    // ✅ What your AuditActionFilter expects:
    public int? UserId { get; set; }

    [MaxLength(120)]
    public string Entity { get; set; } = "";

    // JSON string of details (request/response/meta)
    public string? DetailsJson { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    // Recommended fields (safe defaults)
    [MaxLength(80)]
    public string Action { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
