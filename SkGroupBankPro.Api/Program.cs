using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Services;
using SkGroupBankpro.Api.Utilities;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ✅ Controllers + DateOnly/TimeOnly JSON support
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
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
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

// ✅ SignalR realtime
builder.Services.AddSignalR();

// ✅ Auto rebates background service
builder.Services.AddHostedService<AutoRebateService>();

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

                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/dashboard"))
                {
                    context.Token = accessToken!;
                }

                return Task.CompletedTask;
            }
        };
    });

/* ---------------- CORS (FIXED FOR NETLIFY) ----------------
   ✅ No AllowCredentials() needed (you use Bearer tokens, not cookies)
   ✅ This must match your Netlify domains exactly
*/
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

var app = builder.Build();

/* ---------------- PIPELINE ---------------- */
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SkGroup BankPro API v1");
});

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// ✅ CRITICAL: CORS must be between Routing and Auth
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ✅ SignalR endpoint
app.MapHub<DashboardHub>("/hubs/dashboard");

// ✅ Serve index.html for root/unknown routes (keep only if you host UI inside API)
app.MapFallbackToFile("index.html");

/* ---------------- SEED + CLEANUP ---------------- */
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher>();

    await db.Database.EnsureCreatedAsync();

    // ✅ CLEANUP: remove bad DailyWinLoss records (e.g., year 0001)
    var cutoff = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    var badDaily = await db.DailyWinLosses
        .Where(x => x.DateUtc < cutoff)
        .ToListAsync();

    if (badDaily.Count > 0)
    {
        db.DailyWinLosses.RemoveRange(badDaily);
        await db.SaveChangesAsync();
    }

    // ✅ Seed Admin
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

    // ✅ Seed Game Types
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
