using System.ComponentModel.DataAnnotations.Schema;

namespace SkGroupBankpro.Api.Models
{
    public class DailyWinLoss
    {
        public int Id { get; set; }

        public int CustomerId { get; set; }
        public Customer? Customer { get; set; }

        public int GameTypeId { get; set; }
        public GameType? GameType { get; set; }

        // Total accumulated net loss
        public decimal Total { get; set; }

        // Explicit net loss (used for rebates)
        public decimal NetLoss { get; set; }

        // UTC anchor for PNG business date (PNG midnight converted to UTC)
        public DateTime DateUtc { get; set; }

        // ✅ Derived from DateUtc (not stored in DB)
        [NotMapped]
        public DateOnly BusinessDatePng
        {
            get
            {
                var tz = GetPngTimeZone();
                var pngLocal = TimeZoneInfo.ConvertTimeFromUtc(
                    DateTime.SpecifyKind(DateUtc, DateTimeKind.Utc),
                    tz
                );
                return DateOnly.FromDateTime(pngLocal.Date);
            }
        }

        private static TimeZoneInfo GetPngTimeZone()
        {
            var id = OperatingSystem.IsWindows()
                ? "West Pacific Standard Time"
                : "Pacific/Port_Moresby";

            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
    }
}
