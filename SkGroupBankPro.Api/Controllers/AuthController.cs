using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Services;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AppDbContext db, JwtService jwt, PasswordHasher hasher) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly JwtService _jwt = jwt;
    private readonly PasswordHasher _hasher = hasher;

    // ✅ POST /api/auth/login
    [HttpPost("login")]
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

    // ✅ GET /api/auth/ping (helps you confirm deploy is correct)
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, utc = DateTime.UtcNow });
}

public sealed class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}
