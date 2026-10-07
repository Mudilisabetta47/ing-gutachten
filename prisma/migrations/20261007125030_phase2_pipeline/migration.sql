-- Phase 2: Pipeline Inquiry -> Lead -> Kunde / Fahrzeug / Fall
-- pg_trgm: Teilstring-Suche (Name, E-Mail, Kennzeichen, VIN, Fallnummer) ohne Seq-Scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'CONVERTED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('STORED', 'MAIL_ONLY', 'NOT_STORED');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('NOTE', 'PHONE_CALL');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PRIVATE', 'BUSINESS');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUG_IN_HYBRID', 'LPG', 'CNG', 'HYDROGEN', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('ACCIDENT_REPORT', 'DAMAGE_REPORT', 'VALUATION', 'COST_ESTIMATE', 'ACCIDENT_ANALYSIS', 'RECONSTRUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'INSPECTED', 'DOCUMENTS_MISSING', 'IN_PROGRESS', 'REPORT_READY', 'REPORT_SENT', 'INVOICED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'website_form',
    "form_version" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "vehicle_kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "license_plate" TEXT,
    "message" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "privacy_version" TEXT NOT NULL,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer_host" TEXT,
    "landing_path" TEXT,
    "ip_hash" TEXT,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_attachments" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL,
    "storage_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'website_form',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone_norm" TEXT,
    "location" TEXT,
    "reason" TEXT NOT NULL,
    "vehicle_kind" TEXT NOT NULL,
    "license_plate" TEXT,
    "license_plate_norm" TEXT,
    "message" TEXT,
    "assigned_to_id" TEXT,
    "next_action_at" TIMESTAMP(3),
    "closed_reason" TEXT,
    "notification_status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "notification_error" TEXT,
    "notified_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "converted_by_id" TEXT,
    "converted_customer_id" TEXT,
    "converted_vehicle_id" TEXT,
    "converted_case_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "from_status" "LeadStatus",
    "to_status" "LeadStatus" NOT NULL,
    "actor_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'PRIVATE',
    "company" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone_norm" TEXT,
    "street" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "anonymized_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "license_plate" TEXT,
    "license_plate_norm" TEXT,
    "vin" TEXT,
    "first_registration" DATE,
    "mileage" INTEGER,
    "fuel_type" "FuelType",
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "service_type" "ServiceType" NOT NULL DEFAULT 'ACCIDENT_REPORT',
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "assigned_expert_id" TEXT,
    "created_by_id" TEXT,
    "damage_date" DATE,
    "accident_date" DATE,
    "inspection_location" TEXT,
    "insurance_name" TEXT,
    "insurance_claim_number" TEXT,
    "opposing_insurance" TEXT,
    "opposing_claim_number" TEXT,
    "lawyer" TEXT,
    "repair_shop" TEXT,
    "description" TEXT,
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_counters" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "from_status" "CaseStatus",
    "to_status" "CaseStatus" NOT NULL,
    "actor_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "kind" "NoteKind" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "author_id" TEXT,
    "lead_id" TEXT,
    "customer_id" TEXT,
    "case_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_received_at_idx" ON "inquiries"("received_at");

-- CreateIndex
CREATE INDEX "inquiries_ip_hash_received_at_idx" ON "inquiries"("ip_hash", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_attachments_storage_key_key" ON "inquiry_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "inquiry_attachments_inquiry_id_idx" ON "inquiry_attachments"("inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_inquiry_id_key" ON "leads"("inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_converted_case_id_key" ON "leads"("converted_case_id");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_assigned_to_id_status_idx" ON "leads"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "leads_next_action_at_idx" ON "leads"("next_action_at");

-- CreateIndex
CREATE INDEX "leads_notification_status_idx" ON "leads"("notification_status");

-- CreateIndex
CREATE INDEX "leads_license_plate_norm_idx" ON "leads"("license_plate_norm");

-- CreateIndex
CREATE INDEX "leads_phone_norm_idx" ON "leads"("phone_norm");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_name_trgm" ON "leads" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "lead_status_history_lead_id_created_at_idx" ON "lead_status_history"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "customers_last_name_first_name_idx" ON "customers"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_phone_norm_idx" ON "customers"("phone_norm");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE INDEX "customers_last_name_trgm" ON "customers" USING GIN ("last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "customers_email_trgm" ON "customers" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "customers_company_trgm" ON "customers" USING GIN ("company" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "vehicles_customer_id_idx" ON "vehicles"("customer_id");

-- CreateIndex
CREATE INDEX "vehicles_license_plate_norm_idx" ON "vehicles"("license_plate_norm");

-- CreateIndex
CREATE INDEX "vehicles_vin_idx" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "vehicles_deleted_at_idx" ON "vehicles"("deleted_at");

-- CreateIndex
CREATE INDEX "vehicles_plate_trgm" ON "vehicles" USING GIN ("license_plate_norm" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "vehicles_vin_trgm" ON "vehicles" USING GIN ("vin" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");

-- CreateIndex
CREATE INDEX "cases_status_created_at_idx" ON "cases"("status", "created_at");

-- CreateIndex
CREATE INDEX "cases_customer_id_idx" ON "cases"("customer_id");

-- CreateIndex
CREATE INDEX "cases_vehicle_id_idx" ON "cases"("vehicle_id");

-- CreateIndex
CREATE INDEX "cases_assigned_expert_id_status_idx" ON "cases"("assigned_expert_id", "status");

-- CreateIndex
CREATE INDEX "cases_created_at_idx" ON "cases"("created_at");

-- CreateIndex
CREATE INDEX "cases_deleted_at_idx" ON "cases"("deleted_at");

-- CreateIndex
CREATE INDEX "cases_insurance_claim_number_idx" ON "cases"("insurance_claim_number");

-- CreateIndex
CREATE INDEX "cases_number_trgm" ON "cases" USING GIN ("case_number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "case_status_history_case_id_created_at_idx" ON "case_status_history"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_lead_id_created_at_idx" ON "notes"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_customer_id_created_at_idx" ON "notes"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_case_id_created_at_idx" ON "notes"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_customer_id_fkey" FOREIGN KEY ("converted_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_vehicle_id_fkey" FOREIGN KEY ("converted_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_case_id_fkey" FOREIGN KEY ("converted_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_expert_id_fkey" FOREIGN KEY ("assigned_expert_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Integritaet, die Prisma nicht ausdruecken kann
-- ---------------------------------------------------------------------

-- Eine Notiz gehoert zu genau einem Objekt (Lead, Kunde oder Fall).
ALTER TABLE "notes" ADD CONSTRAINT "notes_exactly_one_target"
  CHECK (num_nonnulls("lead_id", "customer_id", "case_id") = 1);

-- Fallnummer-Zaehler darf nie negativ sein; Kilometerstand ebenso.
ALTER TABLE "case_counters" ADD CONSTRAINT "case_counters_non_negative" CHECK ("last_value" >= 0);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_mileage_non_negative" CHECK ("mileage" IS NULL OR "mileage" >= 0);

-- Inquiry ist unveraenderlich: das Original der Website-Anfrage bleibt, wie es einging.
-- Erlaubt sind nur Loeschung (DSGVO-Verfahren) und gezielte Anonymisierung der
-- personenbezogenen Felder; alle anderen Felder duerfen sich nie aendern.
CREATE OR REPLACE FUNCTION inquiries_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."received_at" IS DISTINCT FROM OLD."received_at"
     OR NEW."source" IS DISTINCT FROM OLD."source"
     OR NEW."form_version" IS DISTINCT FROM OLD."form_version"
     OR NEW."reason" IS DISTINCT FROM OLD."reason"
     OR NEW."vehicle_kind" IS DISTINCT FROM OLD."vehicle_kind"
     OR NEW."consent_at" IS DISTINCT FROM OLD."consent_at"
     OR NEW."privacy_version" IS DISTINCT FROM OLD."privacy_version" THEN
    RAISE EXCEPTION 'inquiries sind unveraenderlich (Feld % wurde veraendert)', TG_TABLE_NAME
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  -- Personenbezogene Felder duerfen nur auf einen Anonymisierungswert gesetzt werden.
  IF (NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name" <> '[anonymisiert]')
     OR (NEW."email" IS DISTINCT FROM OLD."email" AND NEW."email" <> '[anonymisiert]')
     OR (NEW."phone" IS DISTINCT FROM OLD."phone" AND NEW."phone" <> '[anonymisiert]')
     OR (NEW."location" IS DISTINCT FROM OLD."location" AND NEW."location" IS NOT NULL)
     OR (NEW."license_plate" IS DISTINCT FROM OLD."license_plate" AND NEW."license_plate" IS NOT NULL)
     OR (NEW."message" IS DISTINCT FROM OLD."message" AND NEW."message" IS NOT NULL)
     OR (NEW."ip_hash" IS DISTINCT FROM OLD."ip_hash" AND NEW."ip_hash" IS NOT NULL) THEN
    RAISE EXCEPTION 'inquiries sind unveraenderlich (nur Anonymisierung erlaubt)'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inquiries_immutable_trg"
  BEFORE UPDATE ON "inquiries"
  FOR EACH ROW EXECUTE FUNCTION inquiries_immutable();
