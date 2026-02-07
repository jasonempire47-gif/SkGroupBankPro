using System.ComponentModel.DataAnnotations;

namespace SkGroupBankpro.Api.Models
{
    public class WalletTransaction
    {
        public int Id { get; set; }

        public int CustomerId { get; set; }

        // Added (used by TransactionsController)
        public int? GameTypeId { get; set; }

        public decimal Amount { get; set; }

        // FIX: controllers compare TxType enum, so make this an enum (NOT string)
        public TxType Type { get; set; } = TxType.Deposit;

        public string Notes { get; set; } = "";

        // Added (used by many controllers)
        public TxDirection Direction { get; set; } = TxDirection.Credit;

        // Added (used by many controllers)
        public TxStatus Status { get; set; } = TxStatus.Pending;

        // Added (used by Bonuses/Transactions controllers)
        public int? CreatedByUserId { get; set; }

        // Controllers referenced CreatedAt (not CreatedAtUtc), so we provide both.
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // Alias property so controller code compiling against CreatedAt works
        public DateTime CreatedAt
        {
            get => CreatedAtUtc;
            set => CreatedAtUtc = value;
        }

        // Added (used by TransactionsController)
        public string BankType { get; set; } = "";

        // Added (used by TransactionsController)
        public string ReferenceNo { get; set; } = "";

        // Navigation (optional but useful)
        public Customer? Customer { get; set; }
        public GameType? GameType { get; set; }
    }
}
