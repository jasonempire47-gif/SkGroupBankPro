namespace SkGroupBankpro.Api.Models;

public enum EventPrizeType
{
    PercentBonus = 1,
    FixedAmount = 2,
    FreeSpin = 3,
    Gift = 4
}

public sealed class EventPrize
{
    public int Id { get; set; }

    public string Label { get; set; } = "";

    public EventPrizeType Type { get; set; } = EventPrizeType.FixedAmount;

    public decimal Value { get; set; }

    public string Currency { get; set; } = "PHP";

    public bool IsEnabled { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
