using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Data;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    
    public DbSet<CustomerContact> CustomerContacts => Set<CustomerContact>();

    public DbSet<User> Users => Set<User>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<GameType> GameTypes => Set<GameType>();

    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();
    public DbSet<DailyWinLoss> DailyWinLosses => Set<DailyWinLoss>();

    public DbSet<WinLoss> WinLosses => Set<WinLoss>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // ✅ NEW: Live event wheel state (single-row JSON)
    public DbSet<LiveEventState> LiveEventStates => Set<LiveEventState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ✅ money precision
        modelBuilder.Entity<WalletTransaction>()
            .Property(x => x.Amount)
            .HasPrecision(18, 4);

        modelBuilder.Entity<WinLoss>()
            .Property(x => x.WinAmount)
            .HasPrecision(18, 4);

        modelBuilder.Entity<WinLoss>()
            .Property(x => x.LossAmount)
            .HasPrecision(18, 4);

        modelBuilder.Entity<DailyWinLoss>()
            .Property(x => x.Total)
            .HasPrecision(18, 4);

        modelBuilder.Entity<DailyWinLoss>()
            .Property(x => x.NetLoss)
            .HasPrecision(18, 4);

        // ✅ performance indexes
        modelBuilder.Entity<WalletTransaction>().HasIndex(x => x.CreatedAtUtc);
        modelBuilder.Entity<WalletTransaction>().HasIndex(x => new { x.CustomerId, x.Type, x.Status, x.CreatedAtUtc });
        modelBuilder.Entity<WalletTransaction>().HasIndex(x => new { x.Status, x.Type, x.CreatedAtUtc });
        modelBuilder.Entity<WalletTransaction>().HasIndex(x => x.ReferenceNo);

        modelBuilder.Entity<DailyWinLoss>().HasIndex(x => x.DateUtc);

        // ✅ SAFETY: only one DailyWinLoss per customer+game+business-day-anchor
        modelBuilder.Entity<DailyWinLoss>()
            .HasIndex(x => new { x.CustomerId, x.GameTypeId, x.DateUtc })
            .IsUnique();

        modelBuilder.Entity<WinLoss>().HasIndex(x => x.DateUtc);
        modelBuilder.Entity<WinLoss>().HasIndex(x => new { x.CustomerId, x.GameTypeId, x.DateUtc });
        modelBuilder.Entity<WinLoss>().HasIndex(x => x.CreatedAtUtc);

        modelBuilder.Entity<User>().HasIndex(x => x.Username).IsUnique();

        modelBuilder.Entity<GameType>().HasIndex(x => x.Name);
        modelBuilder.Entity<GameType>().HasIndex(x => x.IsEnabled);

        modelBuilder.Entity<Customer>().HasIndex(x => x.Name);
        modelBuilder.Entity<Customer>().HasIndex(x => x.Phone);
        modelBuilder.Entity<Customer>().HasIndex(x => x.Status);

        // ✅ audit indexes
        modelBuilder.Entity<AuditLog>().HasIndex(x => x.CreatedAtUtc);
        modelBuilder.Entity<AuditLog>().HasIndex(x => x.UserId);
        modelBuilder.Entity<AuditLog>().HasIndex(x => x.Entity);

        // ✅ optional: tiny index for single-row state (not required, but harmless)
        modelBuilder.Entity<LiveEventState>().HasIndex(x => x.UpdatedAtUtc);
    }
}
