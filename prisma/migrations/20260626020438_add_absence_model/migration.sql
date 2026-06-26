-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultantId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Absence_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Absence_weekStart_idx" ON "Absence"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Absence_consultantId_weekStart_key" ON "Absence"("consultantId", "weekStart");
