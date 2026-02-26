using System.ComponentModel.DataAnnotations;

namespace SkGroupBankpro.Api.Models
{
    public class CustomerContact
    {
        public int Id { get; set; }

        [Required, MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string PhoneNumber { get; set; } = string.Empty;

        [MaxLength(250)]
        public string? Website { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}