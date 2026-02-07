#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace SkGroupBankpro.Api.Dtos
{
#pragma warning restore IDE0130 // Namespace does not match folder structure

    public sealed record CreateDepositRequest(int CustomerId, decimal Amount, string? Notes);
    public sealed record CreateWithdrawalRequest(int CustomerId, decimal Amount, string? Notes);
    public sealed record CreateMoneyRequest(
        int CustomerId,
        decimal Amount,
        string? Notes,
        DateTime? CreatedAtUtc,
        string? BankType,
        string? ReferenceNo,
        int? GameTypeId          // ✅ NEW
    );
}