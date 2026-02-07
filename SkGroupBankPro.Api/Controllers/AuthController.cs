using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Dtos;
using SkGroupBankpro.Api.Services;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly JwtService _jwt;
        private readonly PasswordHasher _hasher;

        public AuthController(AppDbContext db, JwtService jwt, PasswordHasher hasher)
        {
            _db = db;
            _jwt = jwt;
            _hasher = hasher;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Username == req.Username);
            if (user == null) return Unauthorized();

            if (!_hasher.Verify(user.PasswordHash, req.Password))
                return Unauthorized();

            return new LoginResponse
            {
                Token = _jwt.Generate(user),
                Username = user.Username,
                Role = user.Role
            };
        }
    }
}
