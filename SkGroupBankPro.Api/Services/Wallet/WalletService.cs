using System.Globalization;
using SkGroupBankpro.Api.Services.WalletProviders.K3o58k;

namespace SkGroupBankpro.Api.Services.Wallet;

public sealed class WalletService : IWalletService
{
    private readonly K3o58kClient _client;

    public WalletService(K3o58kClient client)
    {
        _client = client;
    }

    public async Task<object> GetAllUsersAsync(CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(
            module: "getUserDetail",
            fields: new Dictionary<string, string?>
            {
                ["pageIndex"] = "0",
                ["sortBy"] = "register",
                ["sortType"] = "ASC",
                ["includeBetInfo"] = "1"
            },
            ct: ct
        );

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw, httpStatus = res.httpStatus };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }

    public async Task<object> GetAllTransactionsAsync(DateTime sDateUtc, DateTime eDateUtc, CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(
            module: "/users/getAllTransaction",
            fields: new Dictionary<string, string?>
            {
                ["pageIndex"] = "0",
                ["sDate"] = sDateUtc.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"),
                ["eDate"] = eDateUtc.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            },
            ct: ct
        );

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw, httpStatus = res.httpStatus };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }

    public async Task<object> SetScoreAsync(string username, decimal amount, string reason, CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(
            module: "transfer",
            fields: new Dictionary<string, string?>
            {
                ["username"] = username,
                ["amount"] = amount.ToString("0.00", CultureInfo.InvariantCulture)
            },
            ct: ct
        );

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw, httpStatus = res.httpStatus };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }

    public async Task<object> RegisterAsync(string username, string password, string name, string referrerCode, CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(
            module: "register",
            fields: new Dictionary<string, string?>
            {
                ["username"] = username,
                ["password"] = password,
                ["name"] = name,
                ["referrerCode"] = referrerCode
            },
            ct: ct
        );

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw, httpStatus = res.httpStatus };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }
}