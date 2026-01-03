/*
  Warnings:

  - Made the column `cityKey` on table `RecentSearch` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `RecentSearch` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecentSearch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "cityKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RecentSearch" ("city", "cityKey", "country", "createdAt", "id", "updatedAt") SELECT "city", "cityKey", "country", "createdAt", "id", "updatedAt" FROM "RecentSearch";
DROP TABLE "RecentSearch";
ALTER TABLE "new_RecentSearch" RENAME TO "RecentSearch";
CREATE UNIQUE INDEX "RecentSearch_cityKey_key" ON "RecentSearch"("cityKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
