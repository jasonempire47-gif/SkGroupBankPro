#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace SkGroupBankpro.Api.Dtos
{
#pragma warning restore IDE0130 // Namespace does not match folder structure

    public sealed class GameCreateRequest
    {
        public string Name { get; set; } = "";
    }

    public sealed class GameUpdateRequest
    {
        public string Name { get; set; } = "";
    }

    public sealed class GameStatusRequest
    {
        public bool IsEnabled { get; set; }
    }

    public sealed class GameResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public bool IsEnabled { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? UpdatedAtUtc { get; set; }
    }
}
