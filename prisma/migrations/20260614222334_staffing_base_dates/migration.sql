/*
  Warnings:

  - Added the required column `endDate` to the `StaffingBase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `StaffingBase` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StaffingBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engagementId" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "persons" INTEGER NOT NULL DEFAULT 0,
    "hours" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    CONSTRAINT "StaffingBase_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StaffingBase" ("engagementId", "hours", "id", "persons", "rank") SELECT "engagementId", "hours", "id", "persons", "rank" FROM "StaffingBase";
DROP TABLE "StaffingBase";
ALTER TABLE "new_StaffingBase" RENAME TO "StaffingBase";
CREATE UNIQUE INDEX "StaffingBase_engagementId_rank_key" ON "StaffingBase"("engagementId", "rank");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
