using Microsoft.AspNetCore.Mvc;
using SkGroupBankpro.Api.Models;
using SkGroupBankpro.Api.Services;

namespace SkGroupBankpro.Api.Controllers
{
    [ApiController]
    [Route("api/walletprovider")]
    public class WalletProviderController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly WalletProviderMemoryStore _store;

        public WalletProviderController(IConfiguration configuration, WalletProviderMemoryStore store)
        {
            _configuration = configuration;
            _store = store;
        }

        [HttpPost("auth")]
        public IActionResult Auth([FromBody] ProviderAuthRequest request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            return Ok(new
            {
                success = true,
                message = "Authentication successful."
            });
        }

        [HttpPost("create-user")]
        public IActionResult CreateUser([FromBody] ProviderUserRequest request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            if (string.IsNullOrWhiteSpace(request.PlayerId) && string.IsNullOrWhiteSpace(request.Username))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "playerId or username is required."
                });
            }

            var playerId = string.IsNullOrWhiteSpace(request.PlayerId)
                ? $"P{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
                : request.PlayerId.Trim();

            var username = string.IsNullOrWhiteSpace(request.Username)
                ? playerId
                : request.Username.Trim();

            if (_store.UsersByPlayerId.ContainsKey(playerId))
            {
                return Ok(new
                {
                    success = true,
                    message = "User already exists.",
                    data = _store.UsersByPlayerId[playerId]
                });
            }

            if (_store.UsernameToPlayerId.ContainsKey(username))
            {
                return Conflict(new
                {
                    success = false,
                    message = "Username already exists."
                });
            }

            var user = new ProviderWalletUser
            {
                PlayerId = playerId,
                Username = username,
                Name = request.Name ?? "",
                Phone = request.Phone ?? "",
                Website = request.Website ?? "",
                GroupName = request.GroupName ?? "",
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "AUD" : request.Currency,
                Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? "Australia/Sydney" : request.Timezone,
                Balance = 0m,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };

            _store.UsersByPlayerId[playerId] = user;
            _store.UsernameToPlayerId[username] = playerId;

            return Ok(new
            {
                success = true,
                message = "User created successfully.",
                data = user
            });
        }

        [HttpPost("user")]
        public IActionResult GetUser([FromBody] ProviderBalanceRequest request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            var user = FindUser(request.PlayerId, request.Username);
            if (user == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "User not found."
                });
            }

            return Ok(new
            {
                success = true,
                data = user
            });
        }

        [HttpPost("balance")]
        public IActionResult Balance([FromBody] ProviderBalanceRequest request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            var user = FindUser(request.PlayerId, request.Username);
            if (user == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "User not found."
                });
            }

            return Ok(new
            {
                success = true,
                playerId = user.PlayerId,
                username = user.Username,
                balance = user.Balance,
                currency = user.Currency
            });
        }

        [HttpPost("deposit")]
        public IActionResult Deposit([FromBody] ProviderTransactionRequest request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            if (request.Amount <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Amount must be greater than 0."
                });
            }

            if (string.IsNullOrWhiteSpace(request.TransactionId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "transactionId is required."
                });
            }

            var user = FindUser(request.PlayerId, request.Username);
            if (user == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "User not found."
                });
            }

            if (_store.TransactionsById.TryGetValue(request.TransactionId, out var existingTx))
            {
                return Ok(new
                {
                    success = true,
                    message = "Duplicate transaction ignored.",
                    transactionId = existingTx.TransactionId,
                    balance = user.Balance,
                    currency = user.Currency
                });
            }

            lock (_store.BalanceLock)
            {
                if (_store.TransactionsById.ContainsKey(request.TransactionId))
                {
                    return Ok(new
                    {
                        success = true,
                        message = "Duplicate transaction ignored.",
                        transactionId = request.TransactionId,
                        balance = user.Balance,
                        currency = user.Currency
                    });
                }

                user.Balance += request.Amount;
                user.UpdatedAtUtc = DateTime.UtcNow;

                var tx = new ProviderWalletTransaction
                {
                    TransactionId = request.TransactionId,
                    PlayerId = user.PlayerId,
                    Username = user.Username,
                    Amount = request.Amount,
                    Currency = string.IsNullOrWhiteSpace(request.Currency) ? user.Currency : request.Currency,
                    Type = "deposit",
                    GameId = request.GameId ?? "",
                    RoundId = request.RoundId ?? "",
                    Remarks = request.Remarks ?? "",
                    CreatedAtUtc = DateTime.UtcNow
                };

                _store.TransactionsById[tx.TransactionId] = tx;
            }

            return Ok(new
            {
                success = true,
                message = "Deposit successful.",
                transactionId = request.TransactionId,
                balance = user.Balance,
                currency = user.Currency
            });
        }

        [HttpPost("debit")]
        public IActionResult Debit([FromBody] ProviderTransactionRequest request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            if (request.Amount <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Amount must be greater than 0."
                });
            }

            if (string.IsNullOrWhiteSpace(request.TransactionId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "transactionId is required."
                });
            }

            var user = FindUser(request.PlayerId, request.Username);
            if (user == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "User not found."
                });
            }

            if (_store.TransactionsById.TryGetValue(request.TransactionId, out var existingTx))
            {
                return Ok(new
                {
                    success = true,
                    message = "Duplicate transaction ignored.",
                    transactionId = existingTx.TransactionId,
                    balance = user.Balance,
                    currency = user.Currency
                });
            }

            lock (_store.BalanceLock)
            {
                if (_store.TransactionsById.ContainsKey(request.TransactionId))
                {
                    return Ok(new
                    {
                        success = true,
                        message = "Duplicate transaction ignored.",
                        transactionId = request.TransactionId,
                        balance = user.Balance,
                        currency = user.Currency
                    });
                }

                if (user.Balance < request.Amount)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Insufficient balance.",
                        balance = user.Balance,
                        currency = user.Currency
                    });
                }

                user.Balance -= request.Amount;
                user.UpdatedAtUtc = DateTime.UtcNow;

                var tx = new ProviderWalletTransaction
                {
                    TransactionId = request.TransactionId,
                    PlayerId = user.PlayerId,
                    Username = user.Username,
                    Amount = request.Amount,
                    Currency = string.IsNullOrWhiteSpace(request.Currency) ? user.Currency : request.Currency,
                    Type = "debit",
                    GameId = request.GameId ?? "",
                    RoundId = request.RoundId ?? "",
                    Remarks = request.Remarks ?? "",
                    CreatedAtUtc = DateTime.UtcNow
                };

                _store.TransactionsById[tx.TransactionId] = tx;
            }

            return Ok(new
            {
                success = true,
                message = "Debit successful.",
                transactionId = request.TransactionId,
                balance = user.Balance,
                currency = user.Currency
            });
        }

        [HttpPost("transaction")]
        public IActionResult Transaction([FromBody] ProviderAuthRequestWithTransaction request)
        {
            if (!IsAuthorized(request.AccessId, request.AccessToken))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "Invalid access credentials."
                });
            }

            if (string.IsNullOrWhiteSpace(request.TransactionId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "transactionId is required."
                });
            }

            if (!_store.TransactionsById.TryGetValue(request.TransactionId, out var tx))
            {
                return NotFound(new
                {
                    success = false,
                    message = "Transaction not found."
                });
            }

            return Ok(new
            {
                success = true,
                data = tx
            });
        }

        private bool IsAuthorized(string? accessId, string? accessToken)
        {
            var expectedAccessId = _configuration["ExternalWalletApi:AccessId"];
            var expectedAccessToken = _configuration["ExternalWalletApi:AccessToken"];

            return !string.IsNullOrWhiteSpace(expectedAccessId)
                && !string.IsNullOrWhiteSpace(expectedAccessToken)
                && string.Equals(accessId, expectedAccessId, StringComparison.Ordinal)
                && string.Equals(accessToken, expectedAccessToken, StringComparison.Ordinal);
        }

        private ProviderWalletUser? FindUser(string? playerId, string? username)
        {
            if (!string.IsNullOrWhiteSpace(playerId) &&
                _store.UsersByPlayerId.TryGetValue(playerId.Trim(), out var byPlayerId))
            {
                return byPlayerId;
            }

            if (!string.IsNullOrWhiteSpace(username) &&
                _store.UsernameToPlayerId.TryGetValue(username.Trim(), out var mappedPlayerId) &&
                _store.UsersByPlayerId.TryGetValue(mappedPlayerId, out var byUsername))
            {
                return byUsername;
            }

            return null;
        }
    }

    public class ProviderAuthRequestWithTransaction : ProviderAuthRequest
    {
        public string TransactionId { get; set; } = "";
    }
}