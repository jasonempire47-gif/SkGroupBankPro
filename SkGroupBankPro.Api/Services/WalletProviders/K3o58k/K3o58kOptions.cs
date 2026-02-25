namespace SkGroupBankpro.Api.Services.WalletProviders.K3o58k;

public sealed class K3o58kOptions
{
    public string BaseUrl { get; set; } = "";          // https://k3o58k.com/api/v1/
    public string AccessId { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 20;
}