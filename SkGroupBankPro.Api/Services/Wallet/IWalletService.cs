using System;
using System.Threading;
using System.Threading.Tasks;

namespace SkGroupBankpro.Api.Services.Wallet;

public interface IWalletService
{
    Task<object> GetAllUsersAsync(CancellationToken ct = default);
    Task<object> GetAllTransactionsAsync(DateTime sDateUtc, DateTime eDateUtc, CancellationToken ct = default);
    Task<object> SetScoreAsync(string username, decimal amount, string reason, CancellationToken ct = default);

    Task<object> RegisterAsync(string username, string password, string name, string referrerCode, CancellationToken ct = default);
}