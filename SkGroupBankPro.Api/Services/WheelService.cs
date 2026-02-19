using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace SkGroupBankpro.Api;

public class WheelUser
{
    public string UserId { get; set; } = "guest";
    public string DisplayName { get; set; } = "Guest";
    public string Tier { get; set; } = "Bronze";
}

public class WheelPrize
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Label { get; set; } = "";
    public int Weight { get; set; } = 1; // higher = more likely
    public string TierMin { get; set; } = "Bronze";
}

public class WheelHistoryItem
{
    public string name { get; set; } = "";
    public string prize { get; set; } = "";
    public DateTime at { get; set; }
}

public class WheelService
{
    // cooldown seconds per spin (mobile friendly)
    private const int COOLDOWN = 60;

    // per-user last spin timestamp
    private readonly ConcurrentDictionary<string, DateTime> _lastSpin = new();
    private readonly ConcurrentQueue<WheelHistoryItem> _history = new();

    // Prize catalogs per tier (NO LIMIT – add as many as you want)
    private readonly List<WheelPrize> _bronze = new()
    {
        new(){ Label="5% Cashback", Weight=20, TierMin="Bronze" },
        new(){ Label="$5 Bonus", Weight=25, TierMin="Bronze" },
        new(){ Label="$10 Bonus", Weight=15, TierMin="Bronze" },
        new(){ Label="Free Spin Pack", Weight=18, TierMin="Bronze" },
        new(){ Label="Try Again", Weight=22, TierMin="Bronze" },
    };

    private readonly List<WheelPrize> _silver = new()
    {
        new(){ Label="10% Cashback", Weight=20, TierMin="Silver" },
        new(){ Label="$20 Bonus", Weight=18, TierMin="Silver" },
        new(){ Label="$30 Bonus", Weight=10, TierMin="Silver" },
        new(){ Label="Tournament Ticket", Weight=20, TierMin="Silver" },
        new(){ Label="Free Bet", Weight=18, TierMin="Silver" },
        new(){ Label="Try Again", Weight=14, TierMin="Silver" },
    };

    private readonly List<WheelPrize> _gold = new()
    {
        new(){ Label="15% Cashback", Weight=18, TierMin="Gold" },
        new(){ Label="$50 Bonus", Weight=14, TierMin="Gold" },
        new(){ Label="$100 Bonus", Weight=8, TierMin="Gold" },
        new(){ Label="Exclusive Gift", Weight=12, TierMin="Gold" },
        new(){ Label="Free Bet $30", Weight=20, TierMin="Gold" },
        new(){ Label="Try Again", Weight=28, TierMin="Gold" },
    };

    private readonly List<WheelPrize> _platinum = new()
    {
        new(){ Label="20% Cashback", Weight=18, TierMin="Platinum" },
        new(){ Label="$150 Bonus", Weight=10, TierMin="Platinum" },
        new(){ Label="$300 Bonus", Weight=5, TierMin="Platinum" },
        new(){ Label="Luxury Gift", Weight=9, TierMin="Platinum" },
        new(){ Label="VIP Trip Raffle", Weight=3, TierMin="Platinum" },
        new(){ Label="Free Bet $80", Weight=16, TierMin="Platinum" },
        new(){ Label="Try Again", Weight=39, TierMin="Platinum" },
    };

    // ---- User Resolution (plug into your auth / DB) ----
    public WheelUser ResolveUser(HttpContext ctx)
    {
        // Replace this with your real user + VIP tier logic.
        // Example:
        // - If JWT exists, read sub + username.
        // - Tier from DB using lifetime deposit thresholds.
        var userId = ctx.User?.Identity?.IsAuthenticated == true
            ? (ctx.User.FindFirst("sub")?.Value ?? "user")
            : "guest";

        var name = ctx.User?.Identity?.IsAuthenticated == true
            ? (ctx.User.Identity?.Name ?? "Member")
            : "Guest";

        // TODO: fetch lifetime deposit from DB and compute tier
        // Bronze/Silver/Gold/Platinum
        var tier = "Bronze";

        return new WheelUser { UserId = userId, DisplayName = name, Tier = tier };
    }

    // ---- Config API ----
    public object GetConfig(WheelUser user)
    {
        var prizes = GetPrizeListForTier(user.Tier);

        return new
        {
            tier = user.Tier,
            prizes = prizes.Select(p => new { id = p.Id, label = p.Label }).ToList(),
            cooldownSeconds = GetCooldownRemaining(user.UserId)
        };
    }

    // ---- Spin API ----
    public object Spin(WheelUser user)
    {
        var remaining = GetCooldownRemaining(user.UserId);
        if (remaining > 0)
        {
            // keep message simple for client handling
            throw new InvalidOperationException($"COOLDOWN:{remaining}");
        }

        var prizes = GetPrizeListForTier(user.Tier);
        if (prizes.Count == 0) throw new InvalidOperationException("No prizes configured.");

        // weighted pick
        var picked = WeightedPick(prizes);
        var index = prizes.FindIndex(p => p.Id == picked.Id);

        // mark last spin
        _lastSpin[user.UserId] = DateTime.UtcNow;

        // record history
        EnqueueHistory(new WheelHistoryItem
        {
            name = user.DisplayName,
            prize = picked.Label,
            at = DateTime.UtcNow
        });

        return new
        {
            index,
            prize = picked.Label,
            cooldownSeconds = COOLDOWN
        };
    }

    public List<WheelHistoryItem> GetHistory(int take)
    {
        return _history.Reverse().Take(take).ToList();
    }

    // ---- Helpers ----
    private int GetCooldownRemaining(string userId)
    {
        if (!_lastSpin.TryGetValue(userId, out var last)) return 0;
        var elapsed = (int)(DateTime.UtcNow - last).TotalSeconds;
        var remaining = COOLDOWN - elapsed;
        return remaining > 0 ? remaining : 0;
    }

    private List<WheelPrize> GetPrizeListForTier(string tier)
    {
        return tier switch
        {
            "Platinum" => _platinum,
            "Gold" => _gold,
            "Silver" => _silver,
            _ => _bronze
        };
    }

    private WheelPrize WeightedPick(List<WheelPrize> prizes)
    {
        var total = prizes.Sum(p => Math.Max(1, p.Weight));
        var roll = RandomNumberGenerator.GetInt32(0, total);

        var acc = 0;
        foreach (var p in prizes)
        {
            acc += Math.Max(1, p.Weight);
            if (roll < acc) return p;
        }
        return prizes[0];
    }

    private void EnqueueHistory(WheelHistoryItem item)
    {
        _history.Enqueue(item);
        while (_history.Count > 200 && _history.TryDequeue(out _)) { }
    }
}
