using System.ComponentModel.DataAnnotations;

namespace SkGroupBankpro.Api.Models
{
    public class Customer
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = "";

        public decimal Balance { get; set; }

        public string Phone { get; set; } = "";

        // FIX: controller expects CustomerStatus (enum), not string
        public CustomerStatus Status { get; set; } = CustomerStatus.Active;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
