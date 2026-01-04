-- CreateTable
CREATE TABLE "FavoriteCity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "cityKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteCity_cityKey_key" ON "FavoriteCity"("cityKey");
