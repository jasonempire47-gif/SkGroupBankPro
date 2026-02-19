using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace SkGroupBankpro.Api.Services.WalletProviders.K3o58k;

public sealed class K3o58kClient
{
    private readonly HttpClient _http;
    private readonly K3o58kOptions _opt;

    public K3o58kClient(HttpClient http, IOptions<K3o58kOptions> opt)
    {
        _http = http;
        _opt = opt.Value;
    }

    public async Task<K3o58kEnvelope<T>> CallAsync<T>(
        string module,
        object? parameters,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.AccessId) ||
            string.IsNullOrWhiteSpace(_opt.AccessToken))
            throw new InvalidOperationException("Wallet credentials not configured.");

        var body = new Dictionary<string, object?>
        {
            ["accessId"] = _opt.AccessId,
            ["accessToken"] = _opt.AccessToken,
            ["module"] = module,
            ["parameters"] = parameters ?? new { }
        };

        using var res = await _http.PostAsJsonAsync("", body, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);

        try
        {
            var parsed = await res.Content.ReadFromJsonAsync<K3o58kEnvelope<T>>(cancellationToken: ct);
            return parsed ?? new K3o58kEnvelope<T>
            {
                ok = false,
                message = "Empty JSON response",
                raw = raw
            };
        }
        catch
        {
            return new K3o58kEnvelope<T>
            {
                ok = false,
                message = "Non-JSON response",
                raw = raw
            };
        }
    }
}
