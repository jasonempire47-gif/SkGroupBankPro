namespace SkGroupBankpro.Api.Models
{
    public sealed class WinLoss
    {
        public int Id { get; set; }

        public int CustomerId { get; set; }
        public Customer? Customer { get; set; }

        public int GameTypeId { get; set; }
        public GameType? GameType { get; set; }

        public decimal WinAmount { get; set; }
        public decimal LossAmount { get; set; }

        public int? CreatedByUserId { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // ✅ IMPORTANT:
        // This is NOT "any UTC timestamp".
        // This is a UTC day-anchor representing PNG midnight for the business date.
        public DateTime DateUtc { get; set; } = DateTime.UtcNow;
    }
}
