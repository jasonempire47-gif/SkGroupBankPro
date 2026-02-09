using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;
using SkGroupBankpro.Api.Services;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AppDbContext db, JwtService jwt, PasswordHasher hasher, IConfiguration cfg) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly JwtService _jwt = jwt;
    private readonly PasswordHasher _hasher = hasher;
    private readonly IConfiguration _cfg = cfg;

    public sealed class LoginRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public sealed class LoginResponse
    {
        public string Token { get; set; } = "";
        public string Username { get; set; } = "";
        public string Role { get; set; } = "";
        public int UserId { get; set; }
    }

    // =========================
    // OPTION B: Separate logins
    // =========================
    
    [AllowAnonymous]
    [HttpPost("login-staff")]
    public Task<IActionResult> LoginStaff([FromBody] LoginRequest req)
        => LoginWithRoleGate(req, allowedRoles: new[] { "Staff" });

    [AllowAnonymous]
    [HttpPost("login-finance")]
    public Task<IActionResult> LoginFinance([FromBody] LoginRequest req)
        => LoginWithRoleGate(req, allowedRoles: new[] { "Finance", "Admin" });

    private async Task<IActionResult> LoginWithRoleGate(LoginRequest req, string[] allowedRoles)
    {
        var username = (req?.Username ?? "").Trim();
        var password = (req?.Password ?? "").Trim();

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            return BadRequest("Username and password are required.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
        if (user == null) return Unauthorized("Invalid username or password.");

        if (!_hasher.Verify(password, user.PasswordHash))
            return Unauthorized("Invalid username or password.");

        var role = (user.Role ?? "").Trim();

        var allowed = allowedRoles.Any(r => r.Equals(role, StringComparison.OrdinalIgnoreCase));
        if (!allowed)
            return StatusCode(403, $"Access denied for role: {role}. Use the correct login portal.");

        // ✅ FIX: your JwtService method is Generate(User user)
        var token = _jwt.Generate(user);

        return Ok(new LoginResponse
        {
            Token = token,
            Username = user.Username,
            Role = role,
            UserId = user.Id
        });
    }

    // =========================
    // Admin: Generate random user
    // POST /api/auth/generate-user
    // =========================

    public sealed class GenerateUserReq
    {
        public string Role { get; set; } = "Staff"; // Staff or Finance
    }

    [HttpPost("generate-user")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GenerateUser([FromBody] GenerateUserReq req)
    {
        var role = (req?.Role ?? "").Trim();
        if (!role.Equals("Staff", StringComparison.OrdinalIgnoreCase) &&
            !role.Equals("Finance", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Role must be Staff or Finance.");

        string username;
        do
        {
            username = $"user{Random.Shared.Next(100000, 999999)}";
        } while (await _db.Users.AnyAsync(x => x.Username.ToLower() == username.ToLower()));

        var password = Guid.NewGuid().ToString("N")[..10];

        var user = new User
        {
            Username = username,
            PasswordHash = _hasher.Hash(password),
            Role = role,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // password returned ONLY once
        return Ok(new { username, password, role });
    }

    // =========================
    // Reset password from login page (PIN ResetKey)
    // POST /api/auth/reset-password
    // =========================

    public sealed class ResetPasswordReq
    {
        public string Username { get; set; } = "";
        public string ResetKey { get; set; } = "";
    }
    
    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordReq req)
    {
        var resetKeyCfg = (_cfg["Auth:ResetKey"] ?? "").Trim();
        if (string.IsNullOrWhiteSpace(resetKeyCfg))
            return StatusCode(500, "Server reset key is not configured.");

        var resetKey = (req?.ResetKey ?? "").Trim();
        if (!resetKey.Equals(resetKeyCfg, StringComparison.Ordinal))
            return StatusCode(403, "Invalid reset key.");

        var username = (req?.Username ?? "").Trim();
        if (string.IsNullOrWhiteSpace(username))
            return BadRequest("Username is required.");

        var user = await _db.Users.FirstOrDefaultAsync(x => x.Username.ToLower() == username.ToLower());
        if (user == null) return NotFound("User not found.");

        var newPassword = Guid.NewGuid().ToString("N")[..10];
        user.PasswordHash = _hasher.Hash(newPassword);

        await _db.SaveChangesAsync();

        return Ok(new { username = user.Username, newPassword });
    }
}
