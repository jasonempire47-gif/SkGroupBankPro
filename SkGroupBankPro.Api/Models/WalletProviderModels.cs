namespace SkGroupBankpro.Api.Models
{
    public class ProviderAuthRequest
    {
        public string AccessId { get; set; } = "";
        public string AccessToken { get; set; } = "";
    }

    public class ProviderUserRequest : ProviderAuthRequest
    {
        public string PlayerId { get; set; } = "";
        public string Username { get; set; } = "";
        public string Name { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Website { get; set; } = "";
        public string GroupName { get; set; } = "";
        public string Currency { get; set; } = "AUD";
        public string Timezone { get; set; } = "Australia/Sydney";
    }

    public class ProviderBalanceRequest : ProviderAuthRequest
    {
        public string PlayerId { get; set; } = "";
        public string Username { get; set; } = "";
    }

    public class ProviderTransactionRequest : ProviderAuthRequest
    {
        public string PlayerId { get; set; } = "";
        public string Username { get; set; } = "";
        public string TransactionId { get; set; } = "";
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "AUD";
        public string GameId { get; set; } = "";
        public string RoundId { get; set; } = "";
        public string Type { get; set; } = "";
        public string Remarks { get; set; } = "";
    }

    public class ProviderWalletUser
    {
        public string PlayerId { get; set; } = "";
        public string Username { get; set; } = "";
        public string Name { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Website { get; set; } = "";
        public string GroupName { get; set; } = "";
        public string Currency { get; set; } = "AUD";
        public string Timezone { get; set; } = "Australia/Sydney";
        public decimal Balance { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    public class ProviderWalletTransaction
    {
        public string TransactionId { get; set; } = "";
        public string PlayerId { get; set; } = "";
        public string Username { get; set; } = "";
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "AUD";
        public string Type { get; set; } = "";
        public string GameId { get; set; } = "";
        public string RoundId { get; set; } = "";
        public string Remarks { get; set; } = "";
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}