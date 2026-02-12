using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Dtos;

public sealed record PrizeDto(
    int Id,
    string Label,
    EventPrizeType Type,
    decimal Value,
    string Currency,
    bool IsEnabled,
    int SortOrder
);

public sealed record UpsertPrizeRequest(
    int? Id,
    string Label,
    EventPrizeType Type,
    decimal Value,
    string Currency,
    bool IsEnabled,
    int SortOrder
);

public sealed record CreateEventCustomerRequest(
    string Name,
    string? Reference
);

public sealed record SpinRequest(
    string CustomerName,
    string? CustomerReference,
    int PrizeId,
    string SpunBy
);

public sealed record SpinResultDto(
    int SpinId,
    string CustomerName,
    string? CustomerReference,
    int PrizeId,
    string PrizeLabel,
    EventPrizeType PrizeType,
    decimal PrizeValue,
    string Currency,
    string SpunBy,
    DateTime CreatedAtUtc
);
