// Program.cs (FULL REPLACEMENT)
// ✅ SkGroup BankPro API + K3o58k Wallet Provider Integration
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Services;
using SkGroupBankpro.Api.Utilities;
using SkGroupBankpro.Api.Services.Wallet;
using SkGroupBankpro.Api.Services.WalletProviders.K3o58k;
using System.Text;

// ✅ Lucky Wheel Service namespace (if WheelService is in SkGroupBankpro.Api root)
using SkGroupBankpro.Api;

var builder = WebApplication.CreateBuilder(args);

/* ---------------- CONTROLLERS ---------------- */
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
    });

builder.Services.AddEndpointsApiExplorer();

/* ---------------- SWAGGER + JWT ---------------- */
builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(t => (t.FullName ?? t.Name).Replace("+", "."));

    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SkGroup BankPro API",
        Version = "v1"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT token}"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = "Bearer"
            }.AsSecurityScheme(),
            Array.Empty<string>()
        }
    });
});

/* ---------------- DATABASE (MAIN) ---------------- */
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"))
);

/* ---------------- SERVICES ---------------- */
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<PasswordHasher>();

// ✅ Lucky Wheel (server-controlled)
builder.Services.AddSingleton<WheelService>();

// ✅ SignalR realtime
builder.Services.AddSignalR();

// ✅ Auto rebates background service (daily rebate cron)
builder.Services.AddHostedService<AutoRebateService>();

// ✅ Auto-create DailyWinLoss from transactions (cashflow proxy)
builder.Services.AddHostedService<TransactionWinLossSyncService>();

/* ---------------- ✅ K3O58K WALLET PROVIDER ---------------- */
// appsettings.json:
// "WalletProviders": { "K3o58k": { "BaseUrl": "https://k3o58k.com/api/v1/", "AccessId": "", "AccessToken": "", "TimeoutSeconds": 20 } }
// Render env vars:
// WalletProviders__K3o58k__AccessId
// WalletProviders__K3o58k__AccessToken
builder.Services.Configure<K3o58kOptions>(builder.Configuration.GetSection("WalletProviders:K3o58k"));

builder.Services.AddHttpClient<K3o58kClient>((sp, http) =>
{
    var opt = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<K3o58kOptions>>().Value;

    if (string.IsNullOrWhiteSpace(opt.BaseUrl))
        throw new InvalidOperationException("WalletProviders:K3o58k:BaseUrl is missing.");

    // ✅ IMPORTANT: BaseUrl must be folder root, NOT index.php
    // Example: https://k3o58k.com/api/v1/
    http.BaseAddress = new Uri(opt.BaseUrl);
    http.Timeout = TimeSpan.FromSeconds(Math.Clamp(opt.TimeoutSeconds, 5, 60));
});

builder.Services.AddScoped<IWalletService, WalletService>();

/* ---------------- JWT ---------------- */
var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            ValidIssuer = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            ClockSkew = TimeSpan.FromMinutes(2),
            NameClaimType = "sub",
            RoleClaimType = System.Security.Claims.ClaimTypes.Role
        };

        // ✅ Allow SignalR token via query string: ?access_token=...
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var path = context.HttpContext.Request.Path;
                var accessToken = context.Request.Query["access_token"];

                // Existing dashboard hub
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/dashboard"))
                    context.Token = accessToken!;

                // ✅ live events hub
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/liveevents"))
                    context.Token = accessToken!;

                return Task.CompletedTask;
            }
        };
    });

/* ---------------- CORS (FRONTEND) ---------------- */
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy
            .WithOrigins(
                "https://skgroup.xyz",
                "https://www.skgroup.xyz",
                "https://skgroup-bankpro.netlify.app"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
    );
});

/* ---------------- RENDER PROXY FIX ---------------- */
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

/* ---------------- PIPELINE ---------------- */
app.UseForwardedHeaders();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SkGroup BankPro API v1");
});

app.UseHttpsRedirection();

// ✅ Needed for wheel UI files under wwwroot/events/*
app.UseStaticFiles();

app.UseRouting();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Existing hub
app.MapHub<DashboardHub>("/hubs/dashboard");

// ✅ Live events hub
app.MapHub<LiveEventsHub>("/hubs/liveevents");

/* ---------------- SEED + ENSURE DB ---------------- */
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher>();

    await db.Database.EnsureCreatedAsync();

    // ✅ Cleanup bad DailyWinLoss records
    var cutoff = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    var badDaily = await db.DailyWinLosses.Where(x => x.DateUtc < cutoff).ToListAsync();
    if (badDaily.Count > 0)
    {
        db.DailyWinLosses.RemoveRange(badDaily);
        await db.SaveChangesAsync();
    }

    // ✅ FORCE: ensure admin exists and ALWAYS reset password to admin123
    var admin = await db.Users.FirstOrDefaultAsync(u => u.Username == "admin");
    if (admin == null)
    {
        db.Users.Add(new SkGroupBankpro.Api.Models.User
        {
            Username = "admin",
            PasswordHash = hasher.Hash("admin123"),
            Role = "Admin",
            CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
    else
    {
        admin.PasswordHash = hasher.Hash("admin123");
        admin.Role = "Admin";
        await db.SaveChangesAsync();
    }

    // ✅ Seed Game Types (only if empty)
    if (!await db.GameTypes.AnyAsync())
    {
        db.GameTypes.AddRange(
            new SkGroupBankpro.Api.Models.GameType { Name = "918Kaya", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Mega888", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Live22", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Live22", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Joker123", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "MegaH5", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();
    }
}

/* ---------------- RENDER PORT BINDING ---------------- */
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    app.Urls.Add($"http://0.0.0.0:{port}");
}

app.Run();

/* ---------------- HELPER EXTENSION FOR SWAGGER SECURITY REQUIREMENT ---------------- */
static class OpenApiRefExt
{
    public static OpenApiSecurityScheme AsSecurityScheme(this OpenApiReference reference)
        => new OpenApiSecurityScheme { Reference = reference };
}