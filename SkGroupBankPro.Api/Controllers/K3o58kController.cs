using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkGroupBankpro.Api.Services.Wallet;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/k3o58k")]
public sealed class K3o58kController : ControllerBase
{
    private readonly K3o58kGateway _gw;

    public K3o58kController(K3o58kGateway gw)
    {
        _gw = gw;
    }

    [HttpPost("call")]
    [Authorize(Roles = "Admin,Finance,SuperAdmin")]
    public async Task<IActionResult> Call([FromBody] Req req, CancellationToken ct)
    {
        var fields = req.Fields ?? new Dictionary<string, string?>();
        return Ok(await _gw.CallAsync(req.Module, fields, ct));
    }

    public sealed class Req
    {
        public string Module { get; set; } = "";
        public Dictionary<string, string?>? Fields { get; set; }
    }
}