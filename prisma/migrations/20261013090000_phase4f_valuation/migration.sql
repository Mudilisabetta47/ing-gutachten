-- CreateEnum
CREATE TYPE "ValuationType" AS ENUM ('REPLACEMENT_VALUE', 'RESIDUAL_VALUE', 'RESIDUAL_OFFER', 'DIMINISHED_VALUE', 'USAGE_LOSS', 'REPAIR_DURATION', 'REPLACEMENT_DURATION');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('GROSS', 'NET', 'NONE');

-- CreateTable
CREATE TABLE "valuation_entries" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "type" "ValuationType" NOT NULL,
    "label" TEXT,
    "amount_cents" INTEGER,
    "days" INTEGER,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'GROSS',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "source_ref" TEXT,
    "reference_date" DATE,
    "valid_until" DATE,
    "note" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by_id" TEXT,

    CONSTRAINT "valuation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuation_comparables" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "mileage" INTEGER,
    "first_reg" DATE,
    "location" TEXT,
    "source_ref" TEXT,
    "seen_on" DATE,
    "note" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "valuation_comparables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "valuation_entries_case_id_type_idx" ON "valuation_entries"("case_id", "type");

-- CreateIndex
CREATE INDEX "valuation_comparables_case_id_idx" ON "valuation_comparables"("case_id");

-- AddForeignKey
ALTER TABLE "valuation_entries" ADD CONSTRAINT "valuation_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation_comparables" ADD CONSTRAINT "valuation_comparables_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "valuation_entries"
  ADD CONSTRAINT "valuation_entries_values_chk" CHECK (("amount_cents" IS NULL OR "amount_cents" BETWEEN 0 AND 100000000000) AND ("days" IS NULL OR "days" BETWEEN 0 AND 3650));
-- je Fall und Typ höchstens ein gewählter, nicht zurückgezogener Eintrag
CREATE UNIQUE INDEX "valuation_entries_selected_key" ON "valuation_entries"("case_id", "type") WHERE "selected" AND "withdrawn_at" IS NULL;
ALTER TABLE "valuation_comparables" ADD CONSTRAINT "valuation_comparables_price_chk" CHECK ("price_cents" BETWEEN 1 AND 100000000000);

SELECT public.ing_harden_public();
