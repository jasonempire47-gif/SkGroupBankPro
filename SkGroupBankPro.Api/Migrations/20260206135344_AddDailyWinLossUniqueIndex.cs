using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SkGroupBankpro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyWinLossUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WinLosses_CustomerId",
                table: "WinLosses");

            migrationBuilder.DropIndex(
                name: "IX_DailyWinLosses_CustomerId_GameTypeId_DateUtc",
                table: "DailyWinLosses");

            migrationBuilder.CreateIndex(
                name: "IX_WinLosses_CreatedAtUtc",
                table: "WinLosses",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_WinLosses_CustomerId_GameTypeId_DateUtc",
                table: "WinLosses",
                columns: new[] { "CustomerId", "GameTypeId", "DateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_WinLosses_DateUtc",
                table: "WinLosses",
                column: "DateUtc");

            migrationBuilder.CreateIndex(
                name: "IX_DailyWinLosses_CustomerId_GameTypeId_DateUtc",
                table: "DailyWinLosses",
                columns: new[] { "CustomerId", "GameTypeId", "DateUtc" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WinLosses_CreatedAtUtc",
                table: "WinLosses");

            migrationBuilder.DropIndex(
                name: "IX_WinLosses_CustomerId_GameTypeId_DateUtc",
                table: "WinLosses");

            migrationBuilder.DropIndex(
                name: "IX_WinLosses_DateUtc",
                table: "WinLosses");

            migrationBuilder.DropIndex(
                name: "IX_DailyWinLosses_CustomerId_GameTypeId_DateUtc",
                table: "DailyWinLosses");

            migrationBuilder.CreateIndex(
                name: "IX_WinLosses_CustomerId",
                table: "WinLosses",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyWinLosses_CustomerId_GameTypeId_DateUtc",
                table: "DailyWinLosses",
                columns: new[] { "CustomerId", "GameTypeId", "DateUtc" });
        }
    }
}
