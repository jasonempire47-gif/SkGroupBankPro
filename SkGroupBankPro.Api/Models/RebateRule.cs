namespace SkGroupBankpro.Api.Models
{
    public class RebateRule
    {
        public int Id { get; set; }

        public int GameTypeId { get; set; }

        public decimal Percent { get; set; }

        public bool Active { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public GameType? GameType { get; set; }
    }
}
