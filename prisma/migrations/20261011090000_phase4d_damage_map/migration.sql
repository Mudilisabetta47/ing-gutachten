-- CreateEnum
CREATE TYPE "DamageKind" AS ENUM ('CURRENT', 'PRIOR', 'USAGE', 'REPAIRED', 'CHECK');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- AlterTable
ALTER TABLE "damages" ADD COLUMN     "kind" "DamageKind" NOT NULL DEFAULT 'CURRENT',
ADD COLUMN     "part_id" TEXT,
ADD COLUMN     "prior_note" TEXT,
ADD COLUMN     "severity" "DamageSeverity",
ADD COLUMN     "view" TEXT;

-- CreateIndex
CREATE INDEX "damages_case_id_part_id_idx" ON "damages"("case_id", "part_id");

