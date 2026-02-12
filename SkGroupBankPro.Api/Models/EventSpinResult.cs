namespace SkGroupBankpro.Api.Models;

public sealed class EventSpinResult
{
    public int Id { get; set; }

    public int EventCustomerId { get; set; }
    public EventCustomer Customer { get; set; } = default!;

    public int EventPrizeId { get; set; }
    public EventPrize Prize { get; set; } = default!;

    // snapshots (what Live Preview reads)
    public string CustomerNameSnapshot { get; set; } = "";
    public string? CustomerReferenceSnapshot { get; set; }

    public string PrizeLabelSnapshot { get; set; } = "";
    public EventPrizeType PrizeTypeSnapshot { get; set; }
    public decimal PrizeValueSnapshot { get; set; }
    public string CurrencySnapshot { get; set; } = "PHP";

    public string SpunBy { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
