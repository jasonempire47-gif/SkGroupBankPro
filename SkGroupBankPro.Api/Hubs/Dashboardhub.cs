using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SkGroupBankpro.Api.Hubs;

[Authorize]
public sealed class DashboardHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var role = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
        if (!string.IsNullOrWhiteSpace(role))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var role = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
        if (!string.IsNullOrWhiteSpace(role))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"role:{role}");
        }

        await base.OnDisconnectedAsync(exception);
    }
}
