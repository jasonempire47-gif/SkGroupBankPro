using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Data;

public sealed class EventsDbContext(DbContextOptions<EventsDbContext> options) : DbContext(options)
{
    public DbSet<EventPrize> EventPrizes => Set<EventPrize>();
    public DbSet<EventCustomer> EventCustomers => Set<EventCustomer>();
    public DbSet<EventSpinResult> EventSpinResults => Set<EventSpinResult>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<EventPrize>(e =>
        {
            e.ToTable("EventPrizes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Label).HasMaxLength(120).IsRequired();
            e.Property(x => x.Currency).HasMaxLength(12).IsRequired();
            e.Property(x => x.Value).HasColumnType("TEXT"); // SQLite decimal safety (EF uses TEXT)
        });

        b.Entity<EventCustomer>(e =>
        {
            e.ToTable("EventCustomers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Reference).HasMaxLength(120);
        });

        b.Entity<EventSpinResult>(e =>
        {
            e.ToTable("EventSpinResults");
            e.HasKey(x => x.Id);

            e.HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.EventCustomerId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Prize)
                .WithMany()
                .HasForeignKey(x => x.EventPrizeId)
                .OnDelete(DeleteBehavior.Restrict);

            e.Property(x => x.CustomerNameSnapshot).HasMaxLength(120).IsRequired();
            e.Property(x => x.PrizeLabelSnapshot).HasMaxLength(120).IsRequired();
            e.Property(x => x.CurrencySnapshot).HasMaxLength(12).IsRequired();
            e.Property(x => x.SpunBy).HasMaxLength(80).IsRequired();

            e.Property(x => x.PrizeValueSnapshot).HasColumnType("TEXT"); // SQLite decimal safety
        });
    }
}
