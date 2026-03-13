using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SkGroupBankPro.Api.Models;

namespace SkGroupBankPro.Api.Controllers
{
    [ApiController]
    [Route("api/walletprovider")]
    public class WalletProviderController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public WalletProviderController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        [HttpPost("sync")]
        public async Task<IActionResult> SyncWallet([FromBody] WalletSyncRequest request)
        {
            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Invalid JSON payload."
                });
            }

            if (string.IsNullOrWhiteSpace(request.WalletId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "wallet_id is required."
                });
            }

            if (string.IsNullOrWhiteSpace(request.PlayerId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "player_id is required."
                });
            }

            try
            {
                var spinPortalUrl = _configuration["SpinPortal:SyncUrl"];
                var apiToken = _configuration["SpinPortal:ApiToken"];

                if (string.IsNullOrWhiteSpace(spinPortalUrl))
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Spin portal sync URL is not configured."
                    });
                }

                var payload = new
                {
                    wallet_id = request.WalletId,
                    player_id = request.PlayerId,
                    name = request.Name,
                    phone = request.Phone,
                    website = request.Website,
                    group_name = request.GroupName,
                    portal_username = request.PortalUsername,
                    status = request.Status,
                    cash_balance = request.CashBalance,
                    spin_token_balance = request.SpinTokenBalance,
                    deposit_amount = request.DepositAmount,
                    conversion_rule = request.ConversionRule,
                    converted_tokens = request.ConvertedTokens,
                    last_sync = request.LastSync,
                    api_reference = request.ApiReference,
                    remarks = request.Remarks
                };

                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(30);

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                if (!string.IsNullOrWhiteSpace(apiToken))
                {
                    client.DefaultRequestHeaders.Authorization =
                        new AuthenticationHeaderValue("Bearer", apiToken);
                }

                var response = await client.PostAsync(spinPortalUrl, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                object portalResponse;
                try
                {
                    portalResponse = JsonSerializer.Deserialize<object>(responseBody) ?? responseBody;
                }
                catch
                {
                    portalResponse = responseBody;
                }

                if (!response.IsSuccessStatusCode)
                {
                    return StatusCode((int)response.StatusCode, new
                    {
                        success = false,
                        message = $"Spin portal returned HTTP {(int)response.StatusCode}.",
                        portal_response = portalResponse
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Wallet synced successfully.",
                    portal_response = portalResponse
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }
    }
}