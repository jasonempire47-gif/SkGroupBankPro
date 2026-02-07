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

var builder = WebApplication.CreateBuilder(args);

/* ---------------- CONTROLLERS + JSON ---------------- */
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
    });

builder.Services.AddEndpointsApiExplorer();

/* ---------------- SWAGGER ---------------- */
builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(t => t.FullName);

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
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

/* ---------------- DATABASE ---------------- */
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"))
);

/* ---------------- SERVICES ---------------- */
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<PasswordHasher>();

// SignalR
builder.Services.AddSignalR();

// Auto rebates service
builder.Services.AddHostedService<AutoRebateService>();

/* ---------------- JWT ---------------- */
var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.RequireHttpsMetadata = true;
        opt.SaveToken = true;

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

                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/dashboard"))
                {
                    context.Token = accessToken!;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

/* ---------------- CORS (FIXED) ----------------
   ✅ Include Netlify + local dev.
   ✅ Explicit origins (required when AllowCredentials is used).
*/
builder.Services.AddCors(o =>
{
    o.AddPolicy("AllowFrontend", p =>
        p.WithOrigins(
            // Netlify custom domains
            "https://skgroup.xyz",
            "https://www.skgroup.xyz",

            // Netlify default domain
            "https://skgroup-bankpro.netlify.app",

            // Local dev
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5000",
            "http://127.0.0.1:5000"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()
    );
});

var app = builder.Build();

/* ---------------- Render/Proxy HTTPS Awareness ----------------
   Render is behind a proxy. This makes ASP.NET correctly see https scheme.
*/
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

/* ---------------- PIPELINE ---------------- */
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SkGroup BankPro API v1");
});

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// ✅ CRITICAL: CORS must be between UseRouting and Authentication
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ✅ SignalR endpoint
app.MapHub<DashboardHub>("/hubs/dashboard");

// ✅ Serve index.html for root/unknown routes (keep only if you host UI from API too)
app.MapFallbackToFile("index.html");

/* ---------------- SEED + CLEANUP ---------------- */
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher>();

    await db.Database.EnsureCreatedAsync();

    // Cleanup bad DailyWinLoss records
    var cutoff = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    var badDaily = await db.DailyWinLosses
        .Where(x => x.DateUtc < cutoff)
        .ToListAsync();

    if (badDaily.Count > 0)
    {
        db.DailyWinLosses.RemoveRange(badDaily);
        await db.SaveChangesAsync();
    }

    // Seed Admin
    if (!await db.Users.AnyAsync(u => u.Username == "admin"))
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

/* ---------------- Render PORT binding ---------------- */
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    app.Urls.Add($"http://0.0.0.0:{port}");
}

app.Run();
