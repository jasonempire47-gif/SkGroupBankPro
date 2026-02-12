namespace SkGroupBankpro.Api.Models;

public sealed class EventCustomer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Reference { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
