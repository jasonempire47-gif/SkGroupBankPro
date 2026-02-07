using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SkGroupBankpro.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixAuditLogFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RebateRules");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_CustomerId",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_DailyWinLosses_CustomerId",
                table: "DailyWinLosses");

            migrationBuilder.AlterColumn<string>(
                name: "Entity",
                table: "AuditLogs",
                type: "TEXT",
                maxLength: 120,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_CreatedAtUtc",
                table: "WalletTransactions",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_CustomerId_Type_Status_CreatedAtUtc",
                table: "WalletTransactions",
                columns: new[] { "CustomerId", "Type", "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_ReferenceNo",
                table: "WalletTransactions",
                column: "ReferenceNo");

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_Status_Type_CreatedAtUtc",
                table: "WalletTransactions",
                columns: new[] { "Status", "Type", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GameTypes_IsEnabled",
                table: "GameTypes",
                column: "IsEnabled");

            migrationBuilder.CreateIndex(
                name: "IX_GameTypes_Name",
                table: "GameTypes",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_DailyWinLosses_CustomerId_GameTypeId_DateUtc",
                table: "DailyWinLosses",
                columns: new[] { "CustomerId", "GameTypeId", "DateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_DailyWinLosses_DateUtc",
                table: "DailyWinLosses",
                column: "DateUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Name",
                table: "Customers",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Phone",
                table: "Customers",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Status",
                table: "Customers",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedAtUtc",
                table: "AuditLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Entity",
                table: "AuditLogs",
                column: "Entity");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_CreatedAtUtc",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_CustomerId_Type_Status_CreatedAtUtc",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_ReferenceNo",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_Status_Type_CreatedAtUtc",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_GameTypes_IsEnabled",
                table: "GameTypes");

            migrationBuilder.DropIndex(
                name: "IX_GameTypes_Name",
                table: "GameTypes");

            migrationBuilder.DropIndex(
                name: "IX_DailyWinLosses_CustomerId_GameTypeId_DateUtc",
                table: "DailyWinLosses");

            migrationBuilder.DropIndex(
                name: "IX_DailyWinLosses_DateUtc",
                table: "DailyWinLosses");

            migrationBuilder.DropIndex(
                name: "IX_Customers_Name",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_Phone",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_Status",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_CreatedAtUtc",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_Entity",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs");

            migrationBuilder.AlterColumn<string>(
                name: "Entity",
                table: "AuditLogs",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 120);

            migrationBuilder.CreateTable(
                name: "RebateRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    GameTypeId = table.Column<int>(type: "INTEGER", nullable: false),
                    Active = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Percent = table.Column<decimal>(type: "TEXT", precision: 9, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RebateRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RebateRules_GameTypes_GameTypeId",
                        column: x => x.GameTypeId,
                        principalTable: "GameTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_CustomerId",
                table: "WalletTransactions",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyWinLosses_CustomerId",
                table: "DailyWinLosses",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_RebateRules_GameTypeId",
                table: "RebateRules",
                column: "GameTypeId");
        }
    }
}
