using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkGroupBankpro.Api.Services.Wallet;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/wallet")]
public sealed class WalletRegisterController : ControllerBase
{
    private readonly IWalletService _wallet;

    public WalletRegisterController(IWalletService wallet)
    {
        _wallet = wallet;
    }

    [HttpPost("register")]
    [Authorize(Roles = "Admin,Finance,SuperAdmin")]
    public async Task<IActionResult> Register([FromBody] RegisterReq req, CancellationToken ct)
    {
        return Ok(await _wallet.RegisterAsync(req.Username, req.Password, req.Name, req.ReferrerCode, ct));
    }

    public sealed class RegisterReq
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public string Name { get; set; } = "";
        public string ReferrerCode { get; set; } = "";
    }
}