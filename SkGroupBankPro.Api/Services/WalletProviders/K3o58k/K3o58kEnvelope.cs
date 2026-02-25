namespace SkGroupBankpro.Api.Services.WalletProviders.K3o58k;

public sealed class K3o58kEnvelope<T>
{
    // Provider response flags (some APIs use ok, some use success)
    public bool ok { get; set; }
    public bool success { get; set; }

    // Provider may use numeric code/status
    public int code { get; set; }

    public string? message { get; set; }

    // Payload (different endpoints might use data or result)
    public T? data { get; set; }
    public T? result { get; set; }

    // Debug helpers (we fill these from client)
    public int httpStatus { get; set; }
    public string? raw { get; set; }

    public bool IsSuccess()
    {
        // Primary success flags
        if (ok || success) return true;

        // Common success codes in some APIs
        if (code == 1 || code == 200) return true;

        return false;
    }
}