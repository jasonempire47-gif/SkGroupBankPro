using SkGroupBankpro.Api.Models;

#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace SkGroupBankpro.Api.Dtos
{
#pragma warning restore IDE0130 // Namespace does not match folder structure

    public record CreateTxRequest(
        int CustomerId,
        string Kind,
        int? GameTypeId,
        string? BankType,
        string? ReferenceNo,
        string? Notes,
        decimal Amount,
        DateTime CreatedAtUtc
    );

    public sealed record CreateCustomerRequest(string Name, string Phone);

    public sealed record UpdateCustomerStatusRequest(CustomerStatus Status);
}
