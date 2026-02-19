using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkGroupBankpro.Api.Services.Wallet;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/wallet")]
public sealed class WalletController : ControllerBase
{
    private readonly IWalletService _wallet;

    public WalletController(IWalletService wallet)
    {
        _wallet = wallet;
    }

    [HttpGet("users")]
    [Authorize(Roles = "Admin,Finance,SuperAdmin")]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        return Ok(await _wallet.GetAllUsersAsync(ct));
    }

    [HttpGet("transactions")]
    [Authorize(Roles = "Finance,Admin,SuperAdmin")]
    public async Task<IActionResult> GetTransactions(
        DateTime sDateUtc,
        DateTime eDateUtc,
        CancellationToken ct)
    {
        return Ok(await _wallet.GetAllTransactionsAsync(sDateUtc, eDateUtc, ct));
    }

    [HttpPost("set-score")]
    [Authorize(Roles = "Finance,SuperAdmin")]
    public async Task<IActionResult> SetScore([FromBody] Req req, CancellationToken ct)
    {
        return Ok(await _wallet.SetScoreAsync(req.Username, req.Amount, req.Reason, ct));
    }

    public sealed class Req
    {
        public string Username { get; set; } = "";
        public decimal Amount { get; set; }
        public string Reason { get; set; } = "";
    }
}
