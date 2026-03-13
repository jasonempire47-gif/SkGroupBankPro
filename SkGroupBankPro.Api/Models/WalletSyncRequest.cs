namespace SkGroupBankPro.Api.Models
{
    public class WalletSyncRequest
    {
        public string WalletId { get; set; } = "";
        public string PlayerId { get; set; } = "";
        public string Name { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Website { get; set; } = "";
        public string GroupName { get; set; } = "";
        public string PortalUsername { get; set; } = "";
        public string Status { get; set; } = "active";
        public decimal CashBalance { get; set; }
        public int SpinTokenBalance { get; set; }
        public decimal DepositAmount { get; set; }
        public string ConversionRule { get; set; } = "100=1";
        public int ConvertedTokens { get; set; }
        public string LastSync { get; set; } = "";
        public string ApiReference { get; set; } = "";
        public string Remarks { get; set; } = "";
    }
}