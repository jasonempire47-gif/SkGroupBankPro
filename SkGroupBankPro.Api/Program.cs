using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Services;
using SkGroupBankpro.Api.Utilities;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

/* ===============================
   CONTROLLERS + JSON
   =============================== */
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        // ✅ IMPORTANT: enums as strings (Approved, Credit, Debit)
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());

        // DateOnly / TimeOnly support
        o.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
    });

builder.Services.AddEndpointsApiExplorer();

/* ===============================
   SWAGGER + JWT
   =============================== */
builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(t => t.FullName);

    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SK GROUP BANKPRO API",
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

/* ===============================
   DATABASE
   =============================== */
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"));
});

/* ===============================
   SERVICES
   =============================== */
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<PasswordHasher>();

// SignalR
builder.Services.AddSignalR();

// Auto rebates background worker
builder.Services.AddHostedService<AutoRebateService>();

/* ===============================
   JWT AUTH
   =============================== */
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
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)
            ),

            ClockSkew = TimeSpan.FromMinutes(2),
            NameClaimType = "sub",
            RoleClaimType = System.Security.Claims.ClaimTypes.Role
        };

        // ✅ SignalR token support (?access_token=)
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(accessToken)
                    && path.StartsWithSegments("/hubs/dashboard"))
                {
                    context.Token = accessToken!;
                }

                return Task.CompletedTask;
            }
        };
    });

/* ===============================
   CORS (NETLIFY)
   =============================== */
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
    );
});

/* ===============================
   RENDER PROXY FIX
   =============================== */
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;

    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

/* ===============================
   PIPELINE (ORDER IS CRITICAL)
   =============================== */

// MUST be first
app.UseForwardedHeaders();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SK GROUP BANKPRO API v1");
});

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// CORS MUST be here
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// SignalR
app.MapHub<DashboardHub>("/hubs/dashboard");

// If serving UI from API (safe to keep)
app.MapFallbackToFile("index.html");

/* ===============================
   DATABASE INIT + SEED
   =============================== */
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher>();

    await db.Database.EnsureCreatedAsync();

    // Cleanup invalid DailyWinLoss
    var cutoff = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    var badDaily = await db.DailyWinLosses
        .Where(x => x.DateUtc < cutoff)
        .ToListAsync();

    if (badDaily.Any())
    {
        db.DailyWinLosses.RemoveRange(badDaily);
        await db.SaveChangesAsync();
    }

    // Seed Admin
    if (!await db.Users.AnyAsync(x => x.Username == "admin"))
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

    // Seed Game Types
    if (!await db.GameTypes.AnyAsync())
    {
        db.GameTypes.AddRange(
            new SkGroupBankpro.Api.Models.GameType { Name = "918Kaya", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Mega888", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Live22", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Pussy888", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "Joker123", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow },
            new SkGroupBankpro.Api.Models.GameType { Name = "MegaH5", IsEnabled = true, CreatedAtUtc = DateTime.UtcNow }
        );

        await db.SaveChangesAsync();
    }
}

/* ===============================
   RENDER PORT BINDING
   =============================== */
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    app.Urls.Add($"http://0.0.0.0:{port}");
}

app.Run();

/* ===============================
   SWAGGER HELPER
   =============================== */
static class OpenApiRefExt
{
    public static OpenApiSecurityScheme AsSecurityScheme(this OpenApiReference reference)
        => new OpenApiSecurityScheme { Reference = reference };
}
