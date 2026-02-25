using SkGroupBankpro.Api.Services.WalletProviders.K3o58k;

namespace SkGroupBankpro.Api.Services.Wallet;

public sealed class K3o58kGateway
{
    private readonly K3o58kClient _client;

    public K3o58kGateway(K3o58kClient client)
    {
        _client = client;
    }

    public async Task<object> CallAsync(string module, Dictionary<string, string?> fields, CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(module, fields, ct);

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw, httpStatus = res.httpStatus };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }
}