using Microsoft.AspNetCore.Mvc;

namespace SkGroupBankpro.Api.Controllers;

[ApiController]
[Route("api/wheel")]
public class WheelController : ControllerBase
{
    private readonly WheelService _wheel;

    public WheelController(WheelService wheel)
    {
        _wheel = wheel;
    }

    // Config: server returns tier + prizes for that tier + remaining cooldown
    [HttpGet("config")]
    public IActionResult Config()
    {
        var user = _wheel.ResolveUser(HttpContext); // your auth/session logic
        var cfg = _wheel.GetConfig(user);
        return Ok(cfg);
    }

    // Spin: server chooses winner securely (client cannot influence)
    [HttpPost("spin")]
    public IActionResult Spin()
    {
        var user = _wheel.ResolveUser(HttpContext);
        var resp = _wheel.Spin(user);
        return Ok(resp);
    }

    [HttpGet("history")]
    public IActionResult History()
    {
        return Ok(new { items = _wheel.GetHistory(30) });
    }
}
