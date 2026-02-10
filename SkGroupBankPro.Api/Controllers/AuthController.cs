using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;
using SkGroupBankpro.Api.Services;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AppDbContext db, JwtService jwt, PasswordHasher hasher) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly JwtService _jwt = jwt;
    private readonly PasswordHasher _hasher = hasher;

    // -------------------------
    // POST /api/auth/login
    // -------------------------
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Username and password are required." });

        var username = req.Username.Trim();

        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username == username);

        if (user == null)
            return Unauthorized(new { message = "Invalid username or password." });

        if (!_hasher.Verify(user.PasswordHash, req.Password))
            return Unauthorized(new { message = "Invalid username or password." });

        var token = _jwt.Generate(user);

        return Ok(new
        {
            token,
            user = new
            {
                id = user.Id,
                username = user.Username,
                role = user.Role
            }
        });
    }

    // -------------------------
    // GET /api/auth/ping
    // -------------------------
    [HttpGet("ping")]
    [AllowAnonymous]
    public IActionResult Ping() => Ok(new { ok = true, utc = DateTime.UtcNow });

    // -------------------------
    // POST /api/auth/generate-user  (ADMIN ONLY)
    // -------------------------
    [HttpPost("generate-user")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GenerateUser([FromBody] GenerateUserRequest req)
    {
        var role = (req?.Role ?? "").Trim();

        if (role != "Staff" && role != "Finance")
            return BadRequest(new { message = "Role must be Staff or Finance." });

        // generate random username + password
        var username = GenerateUsername(role);
        var password = GeneratePassword();

        // ensure unique username
        var attempt = 0;
        while (await _db.Users.AnyAsync(x => x.Username == username))
        {
            attempt++;
            if (attempt > 20) return StatusCode(500, new { message = "Failed to generate unique username." });
            username = GenerateUsername(role);
        }

        var user = new User
        {
            Username = username,
            PasswordHash = _hasher.Hash(password),
            Role = role,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            role = user.Role,
            username = user.Username,
            password
        });
    }

    // -------------------------
    // POST /api/auth/reset-password  (ADMIN ONLY)
    // body: { "username": "staff_xxx", "newPassword": "123456" }
    // -------------------------
    [HttpPost("reset-password")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest(new { message = "Username and newPassword are required." });

        var username = req.Username.Trim();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) return NotFound(new { message = "User not found." });

        if (user.Username == "admin")
            return BadRequest(new { message = "Reset admin password from server seed logic or change-password flow." });

        user.PasswordHash = _hasher.Hash(req.NewPassword.Trim());
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    // -------------------------
    // helpers
    // -------------------------
    private static string GenerateUsername(string role)
    {
        var prefix = role == "Finance" ? "fin" : "staff";
        var rnd = Random.Shared.Next(10000, 99999);
        return $"{prefix}_{rnd}";
    }

    private static string GeneratePassword()
    {
        // simple but strong enough for generated credentials
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
        var buf = new char[10];
        for (int i = 0; i < buf.Length; i++)
            buf[i] = chars[Random.Shared.Next(chars.Length)];
        return new string(buf);
    }
}

public sealed class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class GenerateUserRequest
{
    public string Role { get; set; } = "";
}

public sealed class ResetPasswordRequest
{
    public string Username { get; set; } = "";
    public string NewPassword { get; set; } = "";
}
