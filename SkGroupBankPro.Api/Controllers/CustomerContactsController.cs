using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerContactsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public CustomerContactsController(AppDbContext db)
        {
            _db = db;
        }

        // GET: /api/customercontacts
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _db.CustomerContacts
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            return Ok(list);
        }

        // GET: /api/customercontacts/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetOne(int id)
        {
            var row = await _db.CustomerContacts.FindAsync(id);
            if (row == null) return NotFound();
            return Ok(row);
        }

        // POST: /api/customercontacts
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CustomerContact model)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            model.Id = 0;
            model.CreatedAt = DateTime.UtcNow;
            model.UpdatedAt = null;

            _db.CustomerContacts.Add(model);
            await _db.SaveChangesAsync();

            return Ok(model);
        }

        // PUT: /api/customercontacts/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] CustomerContact model)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var existing = await _db.CustomerContacts.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Name = model.Name;
            existing.PhoneNumber = model.PhoneNumber;
            existing.Website = model.Website;
            existing.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: /api/customercontacts/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _db.CustomerContacts.FindAsync(id);
            if (existing == null) return NotFound();

            _db.CustomerContacts.Remove(existing);
            await _db.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }
    }
}