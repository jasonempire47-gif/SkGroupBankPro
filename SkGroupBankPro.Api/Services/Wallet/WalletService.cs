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
        var res = await _client.CallAsync<object>("/users/getAllUsers", new { }, ct);

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }

    public async Task<object> GetAllTransactionsAsync(DateTime sDateUtc, DateTime eDateUtc, CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(
            "/transactions/getAllTransactions",
            new
            {
                sDate = sDateUtc.ToString("yyyy-MM-dd"),
                eDate = eDateUtc.ToString("yyyy-MM-dd")
            },
            ct);

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }

    public async Task<object> SetScoreAsync(string username, decimal amount, string reason, CancellationToken ct = default)
    {
        var res = await _client.CallAsync<object>(
            "/member/setScore",
            new
            {
                username,
                amount,
                remark = reason
            },
            ct);

        if (!res.IsSuccess())
            return new { ok = false, message = res.message ?? "Provider error", raw = res.raw };

        return new { ok = true, data = res.data ?? res.result ?? new { } };
    }
}