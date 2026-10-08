-- CreateEnum
CREATE TYPE "CalcStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "CalcItemKind" AS ENUM ('PART', 'LABOR', 'PAINT', 'MISC');

-- CreateTable
CREATE TABLE "calculations" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CalcStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "vat_bp" INTEGER NOT NULL DEFAULT 1900,
    "minutes_per_aw" INTEGER NOT NULL DEFAULT 5,
    "rate_body_cents" INTEGER,
    "rate_mechanic_cents" INTEGER,
    "rate_electric_cents" INTEGER,
    "rate_paint_cents" INTEGER,
    "parts_markup_bp" INTEGER NOT NULL DEFAULT 0,
    "paint_material_bp" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "rates_source" TEXT,
    "created_by_id" TEXT,
    "finalized_by_id" TEXT,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_items" (
    "id" TEXT NOT NULL,
    "calculation_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "CalcItemKind" NOT NULL,
    "labor_category" TEXT,
    "description" TEXT NOT NULL,
    "part_number" TEXT,
    "part_id" TEXT,
    "damage_id" TEXT,
    "quantity_x100" INTEGER NOT NULL DEFAULT 100,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "unit_price_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_bp" INTEGER NOT NULL DEFAULT 0,
    "price_source" TEXT,
    "price_date" DATE,
    "note" TEXT,

    CONSTRAINT "calculation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calculations_case_id_status_idx" ON "calculations"("case_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calculations_case_id_version_key" ON "calculations"("case_id", "version");

-- CreateIndex
CREATE INDEX "calculation_items_calculation_id_position_idx" ON "calculation_items"("calculation_id", "position");

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_items" ADD CONSTRAINT "calculation_items_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Plausibilität
ALTER TABLE "calculations"
  ADD CONSTRAINT "calculations_vat_chk" CHECK ("vat_bp" BETWEEN 0 AND 3000),
  ADD CONSTRAINT "calculations_aw_chk" CHECK ("minutes_per_aw" BETWEEN 1 AND 60),
  ADD CONSTRAINT "calculations_markup_chk" CHECK ("parts_markup_bp" BETWEEN 0 AND 10000 AND "paint_material_bp" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "calculations_rates_chk" CHECK (
    ("rate_body_cents" IS NULL OR "rate_body_cents" BETWEEN 0 AND 100000) AND ("rate_mechanic_cents" IS NULL OR "rate_mechanic_cents" BETWEEN 0 AND 100000) AND
    ("rate_electric_cents" IS NULL OR "rate_electric_cents" BETWEEN 0 AND 100000) AND ("rate_paint_cents" IS NULL OR "rate_paint_cents" BETWEEN 0 AND 100000)),
  ADD CONSTRAINT "calculations_final_chk" CHECK ("status" <> 'FINAL' OR "finalized_at" IS NOT NULL);
ALTER TABLE "calculation_items"
  ADD CONSTRAINT "calculation_items_values_chk" CHECK ("quantity_x100" BETWEEN 0 AND 10000000 AND "minutes" BETWEEN 0 AND 100000 AND "unit_price_cents" BETWEEN 0 AND 1000000000 AND "discount_bp" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "calculation_items_labor_chk" CHECK ("labor_category" IS NULL OR "labor_category" IN ('BODY', 'MECHANIC', 'ELECTRIC'));

SELECT public.ing_harden_public();
