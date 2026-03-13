using System.Collections.Concurrent;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Services
{
    public class WalletProviderMemoryStore
    {
        public ConcurrentDictionary<string, ProviderWalletUser> UsersByPlayerId { get; } = new();
        public ConcurrentDictionary<string, string> UsernameToPlayerId { get; } = new();
        public ConcurrentDictionary<string, ProviderWalletTransaction> TransactionsById { get; } = new();
        public object BalanceLock { get; } = new();
    }
}