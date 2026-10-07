-- Phase 3: Termine, Besichtigung, Schaeden, Medien, Fotos, Dokumente
-- btree_gist: erlaubt den Ausschluss ueberlappender Zeitraeume je Gutachter direkt in der Datenbank.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('INSPECTION', 'CONSULTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "MediaBucket" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'FAILED');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('OVERVIEW', 'DAMAGE', 'DETAIL', 'PLATE', 'VIN', 'ODOMETER', 'INTERIOR', 'UNDERBODY', 'REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('REGISTRATION', 'INSURANCE_LETTER', 'POWER_OF_ATTORNEY', 'ASSIGNMENT', 'REPAIR_INVOICE', 'REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DamageArea" AS ENUM ('FRONT', 'REAR', 'LEFT', 'RIGHT', 'ROOF', 'UNDERBODY', 'WHEELS', 'GLASS', 'INTERIOR', 'OTHER');

-- AlterTable
ALTER TABLE "inquiry_attachments" ADD COLUMN     "media_id" TEXT;

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "kind" "AppointmentKind" NOT NULL DEFAULT 'INSPECTION',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PLANNED',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "cancelled_reason" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "weather" TEXT,
    "odometer" INTEGER,
    "note" TEXT,
    "started_by_id" TEXT,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damages" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "area" "DamageArea" NOT NULL,
    "component" TEXT NOT NULL,
    "damage_type" TEXT,
    "description" TEXT,
    "repair_kind" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "damages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumb_key" TEXT,
    "bucket" "MediaBucket" NOT NULL DEFAULT 'PRIVATE',
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "scan_status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_photos" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "category" "PhotoCategory" NOT NULL DEFAULT 'DAMAGE',
    "title" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "damage_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "case_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "case_id" TEXT,
    "customer_id" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "version_of_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_expert_id_starts_at_ends_at_idx" ON "appointments"("expert_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "appointments_starts_at_idx" ON "appointments"("starts_at");

-- CreateIndex
CREATE INDEX "appointments_case_id_starts_at_idx" ON "appointments"("case_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_status_starts_at_idx" ON "appointments"("status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_appointment_id_key" ON "inspections"("appointment_id");

-- CreateIndex
CREATE INDEX "inspections_case_id_idx" ON "inspections"("case_id");

-- CreateIndex
CREATE INDEX "damages_case_id_sort_order_idx" ON "damages"("case_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_storage_key_key" ON "media"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_thumb_key_key" ON "media"("thumb_key");

-- CreateIndex
CREATE INDEX "media_created_at_idx" ON "media"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "case_photos_media_id_key" ON "case_photos"("media_id");

-- CreateIndex
CREATE INDEX "case_photos_case_id_sort_order_idx" ON "case_photos"("case_id", "sort_order");

-- CreateIndex
CREATE INDEX "case_photos_case_id_category_idx" ON "case_photos"("case_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "documents_media_id_key" ON "documents"("media_id");

-- CreateIndex
CREATE INDEX "documents_case_id_created_at_idx" ON "documents"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_customer_id_created_at_idx" ON "documents"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_attachments_media_id_key" ON "inquiry_attachments"("media_id");

-- AddForeignKey
ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damages" ADD CONSTRAINT "damages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damages" ADD CONSTRAINT "damages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_photos" ADD CONSTRAINT "case_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_photos" ADD CONSTRAINT "case_photos_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_photos" ADD CONSTRAINT "case_photos_damage_id_fkey" FOREIGN KEY ("damage_id") REFERENCES "damages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_version_of_id_fkey" FOREIGN KEY ("version_of_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- Integritaet, die Prisma nicht ausdruecken kann
-- ---------------------------------------------------------------------
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_valid" CHECK ("ends_at" > "starts_at");

-- Ein Gutachter kann nicht zeitgleich an zwei Orten sein. Abgesagte/nicht wahrgenommene Termine blockieren nichts.
-- Das gilt auch bei gleichzeitigen Anfragen (race-sicher), weil die Datenbank selbst pruefen.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap_per_expert"
  EXCLUDE USING gist ("expert_id" WITH =, tsrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('PLANNED', 'CONFIRMED', 'DONE'));

ALTER TABLE "media" ADD CONSTRAINT "media_size_positive" CHECK ("size_bytes" > 0);
-- Ein Dokument gehoert zu einem Fall und/oder einem Kunden.
ALTER TABLE "documents" ADD CONSTRAINT "documents_has_owner" CHECK ("case_id" IS NOT NULL OR "customer_id" IS NOT NULL);
