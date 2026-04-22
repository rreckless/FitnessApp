using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StreakService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StreakTrackings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentStreak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LongestStreak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastWorkoutDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StreakTrackings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StreakMilestones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Days = table.Column<int>(type: "integer", nullable: false),
                    XPReward = table.Column<int>(type: "integer", nullable: false),
                    AchievedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StreakMilestones", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StreakTrackings_LastWorkoutDate",
                table: "StreakTrackings",
                column: "LastWorkoutDate");

            migrationBuilder.CreateIndex(
                name: "IX_StreakTrackings_UserId",
                table: "StreakTrackings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StreakMilestones_UserId",
                table: "StreakMilestones",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StreakMilestones_UserId_Days",
                table: "StreakMilestones",
                columns: new[] { "UserId", "Days" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StreakMilestones");

            migrationBuilder.DropTable(
                name: "StreakTrackings");
        }
    }
}
