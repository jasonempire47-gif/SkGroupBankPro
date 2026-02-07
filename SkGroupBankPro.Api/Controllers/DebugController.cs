using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/debug")]
    public class DebugController : ControllerBase
    {
        private readonly AppDbContext _db;

        public DebugController(AppDbContext db)
        {
            _db = db;
        }

        // GET /api/debug/users
        [HttpGet("users")]
        public async Task<IActionResult> Users()
        {
            var users = await _db.Users
                .AsNoTracking()
                .Select(u => new { u.Id, u.Username, u.Role, u.CreatedAtUtc })
                .ToListAsync();

            return Ok(users);
        }
    }
}
