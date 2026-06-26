-- CreateTable
CREATE TABLE "DatabaseBackup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseBackup_pkey" PRIMARY KEY ("id")
);
