using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPProgressionService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserXPs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TotalXP = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CurrentLevel = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    XPToNextLevel = table.Column<int>(type: "integer", nullable: false, defaultValue: 500),
                    LastXPUpdate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserXPs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MuscleGroupRanks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    MuscleGroup = table.Column<int>(type: "integer", nullable: false),
                    Rank = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    TotalVolume = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MuscleGroupRanks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProgressionHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    XPEarned = table.Column<int>(type: "integer", nullable: false),
                    TotalXPAfter = table.Column<int>(type: "integer", nullable: false),
                    LevelBefore = table.Column<int>(type: "integer", nullable: false),
                    LevelAfter = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    RelatedEntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgressionHistories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserXPs_UserId",
                table: "UserXPs",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MuscleGroupRanks_UserId_MuscleGroup",
                table: "MuscleGroupRanks",
                columns: new[] { "UserId", "MuscleGroup" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgressionHistories_UserId",
                table: "ProgressionHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressionHistories_CreatedAt",
                table: "ProgressionHistories",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserXPs");

            migrationBuilder.DropTable(
                name: "MuscleGroupRanks");

            migrationBuilder.DropTable(
                name: "ProgressionHistories");
        }
    }
}
