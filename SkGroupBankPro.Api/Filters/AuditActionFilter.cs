using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Filters;
using SkGroupBankpro.Api.Data;
using SkGroupBankpro.Api.Models;
using System.Text.Json;

#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace SkGroupBankpro.Api.Filters
{
#pragma warning restore IDE0130 // Namespace does not match folder structure

    public sealed class AuditActionFilter : IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            ActionExecutedContext executed = await next();

            // Only log successful requests (customize if needed)
            int statusCode = executed.HttpContext.Response.StatusCode;
            if (statusCode is < 200 or >= 400)
            {
                return;
            }

            string? userIdStr = executed.HttpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            int? userId = int.TryParse(userIdStr, out int uid) ? uid : null;

            AppDbContext db = executed.HttpContext.RequestServices.GetRequiredService<AppDbContext>();

            var details = new
            {
                Route = $"{executed.HttpContext.Request.Method} {executed.HttpContext.Request.Path}",
                Query = executed.HttpContext.Request.QueryString.Value,
                Arguments = context.ActionArguments
            };

            _ = db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = "API_CALL",
                Entity = context.ActionDescriptor.DisplayName ?? "Unknown",
                DetailsJson = JsonSerializer.Serialize(details),
                IpAddress = executed.HttpContext.Connection.RemoteIpAddress?.ToString()
            });

            _ = await db.SaveChangesAsync();
        }
    }
}
