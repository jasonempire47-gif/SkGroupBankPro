#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace SkGroupBankpro.Api.Dtos
{
#pragma warning restore IDE0130 // Namespace does not match folder structure

    public record CreateWinLossRequest(
        int CustomerId,
        int GameTypeId,
        decimal WinAmount,
        decimal LossAmount,
        DateTime DateUtc
    );


    public sealed record UpsertWinLossRequest(int CustomerId, DateTime Date, decimal WinLossAmount);
}
