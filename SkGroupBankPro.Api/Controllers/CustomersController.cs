using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Dtos;
using SkGroupBankpro.Api.Hubs;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/customers")]
    [Authorize]
    public sealed class CustomersController(AppDbContext db, IHubContext<DashboardHub> hub) : ControllerBase
    {
        private readonly AppDbContext _db = db;
        private readonly IHubContext<DashboardHub> _hub = hub;

        [HttpGet]
        public async Task<ActionResult> List([FromQuery] string? q, [FromQuery] CustomerStatus? status)
        {
            IQueryable<Customer> query = _db.Customers.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
            {
#pragma warning disable CS8602
                query = query.Where(c => c.Name.Contains(q) || c.Phone.Contains(q));
#pragma warning restore CS8602
            }

            if (status is not null)
            {
                query = query.Where(c => c.Status == status);
            }

            List<Customer> data = await query
                .OrderByDescending(x => x.Id)
                .Take(500)
                .ToListAsync();

            return Ok(data);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult> Get(int id)
        {
            Customer? customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return customer is null ? NotFound() : Ok(customer);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Finance,Staff")]
        public async Task<ActionResult> Create([FromBody] CreateCustomerRequest req)
        {
            Customer c = new() { Name = req.Name, Phone = req.Phone, Status = CustomerStatus.Active };
            _db.Customers.Add(c);
            await _db.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "customer", action = "created", id = c.Id });

            return Ok(c);
        }

        [HttpPatch("{id:int}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateStatus(int id, [FromBody] UpdateCustomerStatusRequest req)
        {
            Customer? c = await _db.Customers.FirstOrDefaultAsync(x => x.Id == id);
            if (c is null) return NotFound();

            c.Status = req.Status;
            await _db.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("DashboardUpdated", new { entity = "customer", action = "status", id = c.Id });

            return Ok(c);
        }
    }
}
