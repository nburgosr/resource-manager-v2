-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ConsultantSkill" (
    "consultantId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    PRIMARY KEY ("consultantId", "skillId"),
    CONSTRAINT "ConsultantSkill_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConsultantSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "ConsultantSkill_skillId_idx" ON "ConsultantSkill"("skillId");
