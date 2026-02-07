using System.ComponentModel.DataAnnotations;

namespace SkGroupBankpro.Api.Models
{
    public class GameType
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = "";

        // Added (used by GameTypesController / WinLossController / Dashboard)
        public bool IsEnabled { get; set; } = true;

        // Added (used by GameTypesController)
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
