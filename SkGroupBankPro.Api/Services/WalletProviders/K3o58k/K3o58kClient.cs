using System.Text.Json;
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
        IDictionary<string, string?>? fields = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.AccessId) ||
            string.IsNullOrWhiteSpace(_opt.AccessToken))
        {
            return new K3o58kEnvelope<T>
            {
                ok = false,
                message = "Wallet credentials not configured (AccessId / AccessToken missing).",
                httpStatus = 0
            };
        }

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(module), "module");
        form.Add(new StringContent(_opt.AccessId), "accessId");
        form.Add(new StringContent(_opt.AccessToken), "accessToken");

        if (fields != null)
        {
            foreach (var kv in fields)
            {
                if (kv.Value is null) continue;
                form.Add(new StringContent(kv.Value), kv.Key);
            }
        }

        using var res = await _http.PostAsync("index.php", form, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);

        try
        {
            var parsed = JsonSerializer.Deserialize<K3o58kEnvelope<T>>(
                raw,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (parsed == null)
            {
                return new K3o58kEnvelope<T>
                {
                    ok = false,
                    message = "Empty JSON response",
                    raw = raw,
                    httpStatus = (int)res.StatusCode
                };
            }

            parsed.raw = raw;
            parsed.httpStatus = (int)res.StatusCode;
            return parsed;
        }
        catch
        {
            return new K3o58kEnvelope<T>
            {
                ok = false,
                message = $"Non-JSON response (HTTP {(int)res.StatusCode})",
                raw = raw,
                httpStatus = (int)res.StatusCode
            };
        }
    }
}