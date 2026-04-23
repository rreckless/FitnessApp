using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SyncService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SyncQueues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Operation = table.Column<int>(type: "integer", nullable: false),
                    EntityType = table.Column<int>(type: "integer", nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Payload = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RetryCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncQueues", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SyncQueues_CreatedAt",
                table: "SyncQueues",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SyncQueues_Status",
                table: "SyncQueues",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SyncQueues_UserId",
                table: "SyncQueues",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SyncQueues_UserId_Status",
                table: "SyncQueues",
                columns: new[] { "UserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SyncQueues");
        }
    }
}
