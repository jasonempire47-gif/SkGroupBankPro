namespace SkGroupBankpro.Api.Services.WalletProviders.K3o58k;

public sealed class K3o58kEnvelope<T>
{
    public bool ok { get; set; }
    public bool success { get; set; }
    public int code { get; set; }
    public string? message { get; set; }

    public T? data { get; set; }
    public T? result { get; set; }

    public int httpStatus { get; set; }
    public string? raw { get; set; }

    public bool IsSuccess()
        => ok || success || code == 1 || code == 200;
}
