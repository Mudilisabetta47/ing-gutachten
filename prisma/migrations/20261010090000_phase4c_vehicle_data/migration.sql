-- CreateEnum
CREATE TYPE "VehicleVerification" AS ENUM ('VERIFIED', 'PARTIAL', 'UNVERIFIED', 'OUTDATED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "ProviderLicense" AS ENUM ('UNKNOWN', 'REVIEW_REQUIRED', 'APPROVED', 'LICENSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PREVIEW', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportRowOutcome" AS ENUM ('NEW', 'EXISTS', 'CONFLICT', 'INVALID', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'MERGED', 'KEPT_OWN', 'TOOK_EXTERNAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "TypeApprovalKind" AS ENUM ('EC_TYPE_APPROVAL', 'ABE', 'INDIVIDUAL', 'UNKNOWN');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "approval_kind" "TypeApprovalKind",
ADD COLUMN     "approval_number" TEXT,
ADD COLUMN     "body_style" TEXT,
ADD COLUMN     "displacement_cc" INTEGER,
ADD COLUMN     "drive_type" TEXT,
ADD COLUMN     "engine_code" TEXT,
ADD COLUMN     "engine_name" TEXT,
ADD COLUMN     "hsn" TEXT,
ADD COLUMN     "hsn_tsn_id" TEXT,
ADD COLUMN     "power_hp" INTEGER,
ADD COLUMN     "power_kw" INTEGER,
ADD COLUMN     "registration_check" JSONB,
ADD COLUMN     "seats" INTEGER,
ADD COLUMN     "transmission" TEXT,
ADD COLUMN     "tsn" TEXT,
ADD COLUMN     "type_code" TEXT,
ADD COLUMN     "variant_code" TEXT,
ADD COLUMN     "vehicle_class" TEXT,
ADD COLUMN     "version_code" TEXT;

-- CreateTable
CREATE TABLE "vehicle_makes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" TEXT NOT NULL,
    "make_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_generations" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_variants" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "generation_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_hsn_tsn" (
    "id" TEXT NOT NULL,
    "hsn" TEXT NOT NULL,
    "tsn" TEXT NOT NULL,
    "manufacturer_id" TEXT,
    "model_id" TEXT,
    "generation_id" TEXT,
    "variant_id" TEXT,
    "manufacturer_name_raw" TEXT,
    "vehicle_name_raw" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "generation" TEXT,
    "variant" TEXT,
    "body_style" TEXT,
    "engine_name" TEXT,
    "engine_code" TEXT,
    "fuel_type" "FuelType",
    "displacement_cc" INTEGER,
    "power_kw" INTEGER,
    "power_hp" INTEGER,
    "torque_nm" INTEGER,
    "transmission" TEXT,
    "drive_type" TEXT,
    "production_from" DATE,
    "production_to" DATE,
    "type_approval" TEXT,
    "vehicle_class" TEXT,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "source_record_id" TEXT NOT NULL DEFAULT '',
    "source_imported_at" TIMESTAMP(3),
    "source_last_checked_at" TIMESTAMP(3),
    "source_hash" TEXT,
    "importer_version" TEXT,
    "raw_data" JSONB,
    "verification_status" "VehicleVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vehicle_hsn_tsn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_providers" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "license_status" "ProviderLicense" NOT NULL DEFAULT 'UNKNOWN',
    "auto_lookup" BOOLEAN NOT NULL DEFAULT false,
    "mass_import" BOOLEAN NOT NULL DEFAULT false,
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 10,
    "paused_until" TIMESTAMP(3),
    "pause_reason" TEXT,
    "last_connected_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_category" TEXT,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "notes" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_providers_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "vehicle_provider_logs" (
    "id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "http_status" INTEGER,
    "records_found" INTEGER,
    "error_category" TEXT,

    CONSTRAINT "vehicle_provider_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_import_jobs" (
    "id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "params" JSONB,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PREVIEW',
    "total" INTEGER NOT NULL DEFAULT 0,
    "count_new" INTEGER NOT NULL DEFAULT 0,
    "count_exists" INTEGER NOT NULL DEFAULT 0,
    "count_conflict" INTEGER NOT NULL DEFAULT 0,
    "count_invalid" INTEGER NOT NULL DEFAULT 0,
    "count_imported" INTEGER NOT NULL DEFAULT 0,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "paused_until" TIMESTAMP(3),
    "message" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "vehicle_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_import_rows" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "hsn" TEXT,
    "tsn" TEXT,
    "payload" JSONB NOT NULL,
    "outcome" "ImportRowOutcome" NOT NULL,
    "error" TEXT,
    "record_id" TEXT,

    CONSTRAINT "vehicle_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_data_conflicts" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "hsn" TEXT NOT NULL,
    "tsn" TEXT NOT NULL,
    "incoming" JSONB NOT NULL,
    "incoming_source" TEXT NOT NULL,
    "fields" TEXT[],
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_data_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_data_points" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT,
    "priority" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "status" "VehicleVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_data_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_data_history" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "source" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "vehicle_data_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_makes_name_key" ON "vehicle_makes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_models_make_id_name_key" ON "vehicle_models"("make_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_generations_model_id_name_key" ON "vehicle_generations"("model_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_variants_model_id_name_key" ON "vehicle_variants"("model_id", "name");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_hsn_tsn_idx" ON "vehicle_hsn_tsn"("hsn", "tsn");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_hsn_idx" ON "vehicle_hsn_tsn"("hsn");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_manufacturer_idx" ON "vehicle_hsn_tsn"("manufacturer");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_model_idx" ON "vehicle_hsn_tsn"("model");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_source_idx" ON "vehicle_hsn_tsn"("source");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_verification_status_idx" ON "vehicle_hsn_tsn"("verification_status");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_deleted_at_idx" ON "vehicle_hsn_tsn"("deleted_at");

-- CreateIndex
CREATE INDEX "vehicle_hsn_tsn_search_trgm" ON "vehicle_hsn_tsn" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "vehicle_provider_logs_provider_key_at_idx" ON "vehicle_provider_logs"("provider_key", "at");

-- CreateIndex
CREATE INDEX "vehicle_import_jobs_status_idx" ON "vehicle_import_jobs"("status");

-- CreateIndex
CREATE INDEX "vehicle_import_jobs_created_at_idx" ON "vehicle_import_jobs"("created_at");

-- CreateIndex
CREATE INDEX "vehicle_import_rows_job_id_outcome_idx" ON "vehicle_import_rows"("job_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_import_rows_job_id_position_key" ON "vehicle_import_rows"("job_id", "position");

-- CreateIndex
CREATE INDEX "vehicle_data_conflicts_status_idx" ON "vehicle_data_conflicts"("status");

-- CreateIndex
CREATE INDEX "vehicle_data_conflicts_record_id_idx" ON "vehicle_data_conflicts"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_data_points_vehicle_id_field_key" ON "vehicle_data_points"("vehicle_id", "field");

-- CreateIndex
CREATE INDEX "vehicle_data_history_vehicle_id_at_idx" ON "vehicle_data_history"("vehicle_id", "at");

-- CreateIndex
CREATE INDEX "vehicles_hsn_tsn_idx" ON "vehicles"("hsn", "tsn");

-- CreateIndex
CREATE INDEX "vehicles_hsn_tsn_id_idx" ON "vehicles"("hsn_tsn_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_hsn_tsn_id_fkey" FOREIGN KEY ("hsn_tsn_id") REFERENCES "vehicle_hsn_tsn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_generations" ADD CONSTRAINT "vehicle_generations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_variants" ADD CONSTRAINT "vehicle_variants_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_variants" ADD CONSTRAINT "vehicle_variants_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "vehicle_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_hsn_tsn" ADD CONSTRAINT "vehicle_hsn_tsn_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "vehicle_makes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_hsn_tsn" ADD CONSTRAINT "vehicle_hsn_tsn_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_hsn_tsn" ADD CONSTRAINT "vehicle_hsn_tsn_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "vehicle_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_hsn_tsn" ADD CONSTRAINT "vehicle_hsn_tsn_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "vehicle_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_provider_logs" ADD CONSTRAINT "vehicle_provider_logs_provider_key_fkey" FOREIGN KEY ("provider_key") REFERENCES "vehicle_providers"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_import_jobs" ADD CONSTRAINT "vehicle_import_jobs_provider_key_fkey" FOREIGN KEY ("provider_key") REFERENCES "vehicle_providers"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_import_rows" ADD CONSTRAINT "vehicle_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "vehicle_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_data_conflicts" ADD CONSTRAINT "vehicle_data_conflicts_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "vehicle_hsn_tsn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_data_points" ADD CONSTRAINT "vehicle_data_points_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_data_history" ADD CONSTRAINT "vehicle_data_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Plausibilität auf Datenbankebene (die Anwendung prüft zusätzlich)
ALTER TABLE "vehicle_hsn_tsn"
  ADD CONSTRAINT "vehicle_hsn_tsn_hsn_chk" CHECK ("hsn" ~ '^[0-9A-Z]{4}$'),
  ADD CONSTRAINT "vehicle_hsn_tsn_tsn_chk" CHECK ("tsn" ~ '^[0-9A-Z]{3}$'),
  ADD CONSTRAINT "vehicle_hsn_tsn_values_chk" CHECK (
    ("power_kw" IS NULL OR "power_kw" BETWEEN 1 AND 2000) AND ("power_hp" IS NULL OR "power_hp" BETWEEN 1 AND 3000) AND
    ("displacement_cc" IS NULL OR "displacement_cc" BETWEEN 1 AND 20000)),
  ADD CONSTRAINT "vehicle_hsn_tsn_period_chk" CHECK ("production_from" IS NULL OR "production_to" IS NULL OR "production_to" >= "production_from");

-- Keine doppelten Datensätze: je HSN/TSN, Quelle und Quell-ID genau einer (archivierte ausgenommen)
CREATE UNIQUE INDEX "vehicle_hsn_tsn_identity_key" ON "vehicle_hsn_tsn"("hsn", "tsn", "source", "source_record_id") WHERE "deleted_at" IS NULL;

ALTER TABLE "vehicle_providers" ADD CONSTRAINT "vehicle_providers_rate_chk" CHECK ("rate_limit_per_min" BETWEEN 1 AND 120);
ALTER TABLE "vehicle_data_points" ADD CONSTRAINT "vehicle_data_points_prio_chk" CHECK ("priority" BETWEEN 0 AND 100);

-- Provider-Grundbestand. Externe Anbieter starten aus, ohne Freigabe und ohne automatische Abfragen.
INSERT INTO "vehicle_providers" ("key", "name", "kind", "description", "enabled", "license_status", "updated_at") VALUES
  ('OWN',      'Eigene Datenbank',      'internal', 'Interne Fahrzeugdatenbank (HSN/TSN-Katalog). Wird immer zuerst durchsucht.', true,  'LICENSED',        now()),
  ('MANUAL',   'Manuelle Daten',        'internal', 'Vom Gutachter erfasste oder bestätigte Fahrzeugdaten.',                       true,  'LICENSED',        now()),
  ('HSN_TSN',  'HSN/TSN-Anbieter',      'external', 'Öffentlich abrufbare HSN/TSN-Fahrzeugseiten (Adapter für hsn-tsn.de). Nur nach rechtlicher Prüfung und ausdrücklicher Freigabe.', false, 'REVIEW_REQUIRED', now()),
  ('KBA',      'KBA',                   'external', 'Kraftfahrt-Bundesamt – noch nicht angebunden.',                                false, 'UNKNOWN',         now()),
  ('DAT',      'DAT',                   'external', 'DAT-Fahrzeugdaten – noch nicht angebunden (Lizenz erforderlich).',            false, 'UNKNOWN',         now()),
  ('VIN',      'VIN-Anbieter',          'external', 'FIN-Decoder – noch nicht angebunden.',                                         false, 'UNKNOWN',         now());

SELECT public.ing_harden_public();
