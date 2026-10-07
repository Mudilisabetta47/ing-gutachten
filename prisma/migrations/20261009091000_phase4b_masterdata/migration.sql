-- Phase 4 / M1: Standorte, Stammdaten (Organisationen), Faelle um Prioritaet/Schadenart/Zuordnungen erweitert; Statusmigration
-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');
-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('LIABILITY', 'COMPREHENSIVE', 'PARTIAL_COMPREHENSIVE', 'OWN_DAMAGE', 'VALUATION', 'EVIDENCE', 'OTHER');
-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('INSURANCE', 'LAWYER', 'WORKSHOP', 'DEALERSHIP', 'PARTNER');
-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "accident_place" TEXT,
ADD COLUMN     "adjuster_email" TEXT,
ADD COLUMN     "adjuster_name" TEXT,
ADD COLUMN     "adjuster_phone" TEXT,
ADD COLUMN     "claim_type" "ClaimType",
ADD COLUMN     "dealership_org_id" TEXT,
ADD COLUMN     "insurance_org_id" TEXT,
ADD COLUMN     "insurance_policy_number" TEXT,
ADD COLUMN     "lawyer_org_id" TEXT,
ADD COLUMN     "lawyer_reference" TEXT,
ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "partner_org_id" TEXT,
ADD COLUMN     "pinned_note" TEXT,
ADD COLUMN     "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "workshop_org_id" TEXT;
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "location_id" TEXT;
-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "opening_hours" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "kind" "OrganizationKind" NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "street" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "claims_email" TEXT,
    "portal_url" TEXT,
    "notes" TEXT,
    "rate_mechanic_cents" INTEGER,
    "rate_body_cents" INTEGER,
    "rate_electric_cents" INTEGER,
    "rate_paint_cents" INTEGER,
    "shipping_cents" INTEGER,
    "parts_markup_bp" INTEGER,
    "paint_material_bp" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "locations_deleted_at_idx" ON "locations"("deleted_at");
-- CreateIndex
CREATE INDEX "organizations_kind_name_idx" ON "organizations"("kind", "name");
-- CreateIndex
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");
-- CreateIndex
CREATE INDEX "organizations_name_trgm" ON "organizations" USING GIN ("name" gin_trgm_ops);
-- CreateIndex
CREATE INDEX "cases_priority_status_idx" ON "cases"("priority", "status");
-- CreateIndex
CREATE INDEX "cases_location_id_idx" ON "cases"("location_id");
-- CreateIndex
CREATE INDEX "cases_insurance_org_id_idx" ON "cases"("insurance_org_id");
-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_insurance_org_id_fkey" FOREIGN KEY ("insurance_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_lawyer_org_id_fkey" FOREIGN KEY ("lawyer_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_workshop_org_id_fkey" FOREIGN KEY ("workshop_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_dealership_org_id_fkey" FOREIGN KEY ("dealership_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_partner_org_id_fkey" FOREIGN KEY ("partner_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Daten: altes Statusmodell auf das neue abbilden (Historie bleibt unveraendert lesbar)
-- ---------------------------------------------------------------------
UPDATE "cases" SET "status" = 'REPORT_DRAFT' WHERE "status" = 'IN_PROGRESS';
UPDATE "cases" SET "status" = 'INSPECTED'    WHERE "status" = 'DOCUMENTS_MISSING';
UPDATE "cases" SET "status" = 'APPROVED'     WHERE "status" = 'REPORT_READY';
UPDATE "cases" SET "status" = 'SENT'         WHERE "status" = 'REPORT_SENT';
UPDATE "cases" SET "status" = 'BILLING'      WHERE "status" = 'INVOICED';

-- Hauptstandort (nur, wenn noch keiner existiert) – Angaben aus dem oeffentlichen Impressum
INSERT INTO "locations" ("id", "name", "street", "postal_code", "city", "phone", "is_default", "updated_at")
SELECT 'loc_haupt', 'Hannover (Hauptstandort)', 'Hildesheimer Straße 229', '30519', 'Hannover', '0511 54300976', true, now()
WHERE NOT EXISTS (SELECT 1 FROM "locations");

-- Supabase/API-Rollen aussperren (siehe Migration supabase_hardening)
SELECT public.ing_harden_public();
