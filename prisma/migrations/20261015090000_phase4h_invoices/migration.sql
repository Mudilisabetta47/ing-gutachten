-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK', 'CASH', 'CARD', 'OFFSET', 'OTHER');

-- CreateEnum
CREATE TYPE "DunningStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "invoice_counters" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "case_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "recipient_name" TEXT NOT NULL,
    "recipient_street" TEXT,
    "recipient_postal_code" TEXT,
    "recipient_city" TEXT,
    "recipient_org_id" TEXT,
    "recipient_ref" TEXT,
    "service_date" DATE,
    "issue_date" DATE,
    "due_date" DATE,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 14,
    "intro_text" TEXT,
    "footer_text" TEXT,
    "net_cents" INTEGER NOT NULL DEFAULT 0,
    "vat_cents" INTEGER NOT NULL DEFAULT 0,
    "gross_cents" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "issued_at" TIMESTAMP(3),
    "issued_by_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity_x100" INTEGER NOT NULL DEFAULT 100,
    "unit" TEXT,
    "unit_price_cents" INTEGER NOT NULL,
    "vat_bp" INTEGER NOT NULL DEFAULT 1900,
    "service_id" TEXT,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK',
    "reference" TEXT,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMP(3),
    "reversed_by_id" TEXT,
    "reverse_reason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunning_notices" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "DunningStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATE,
    "due_date" DATE,
    "fee_cents" INTEGER NOT NULL DEFAULT 0,
    "interest_cents" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT,
    "created_by_id" TEXT,
    "issued_by_id" TEXT,
    "issued_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dunning_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "unit_price_cents" INTEGER NOT NULL,
    "vat_bp" INTEGER NOT NULL DEFAULT 1900,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_case_id_idx" ON "invoices"("case_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_position_idx" ON "invoice_items"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_paid_on_idx" ON "payments"("paid_on");

-- CreateIndex
CREATE INDEX "dunning_notices_invoice_id_idx" ON "dunning_notices"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dunning_notices" ADD CONSTRAINT "dunning_notices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Plausibilität
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amounts_chk" CHECK ("net_cents" >= 0 AND "vat_cents" >= 0 AND "gross_cents" = "net_cents" + "vat_cents"),
  ADD CONSTRAINT "invoices_terms_chk" CHECK ("payment_terms_days" BETWEEN 0 AND 365),
  ADD CONSTRAINT "invoices_issued_chk" CHECK ("status" = 'DRAFT' OR ("number" IS NOT NULL AND "issue_date" IS NOT NULL AND "due_date" IS NOT NULL AND "issued_at" IS NOT NULL)),
  ADD CONSTRAINT "invoices_cancel_chk" CHECK ("status" <> 'CANCELLED' OR ("cancelled_at" IS NOT NULL AND "cancel_reason" IS NOT NULL));
ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_values_chk" CHECK ("quantity_x100" BETWEEN 1 AND 100000000 AND "unit_price_cents" BETWEEN -1000000000 AND 1000000000 AND "vat_bp" BETWEEN 0 AND 3000);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_chk" CHECK ("amount_cents" > 0 AND "amount_cents" < 100000000000);
ALTER TABLE "dunning_notices"
  ADD CONSTRAINT "dunning_level_chk" CHECK ("level" BETWEEN 1 AND 3),
  ADD CONSTRAINT "dunning_fees_chk" CHECK ("fee_cents" >= 0 AND "interest_cents" >= 0);
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_values_chk" CHECK ("unit_price_cents" BETWEEN -1000000000 AND 1000000000 AND "vat_bp" BETWEEN 0 AND 3000);

-- Ausgestellte Rechnungen sind unveränderlich (GoBD): nach der Ausstellung ist nur noch die Stornierung erlaubt.
CREATE OR REPLACE FUNCTION ing_invoice_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Ausgestellte Rechnungen koennen nicht geloescht werden' USING ERRCODE = '23000'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'DRAFT' THEN RETURN NEW; END IF;
  IF OLD.status = 'CANCELLED' THEN RAISE EXCEPTION 'Stornierte Rechnungen sind unveraenderlich' USING ERRCODE = '23000'; END IF;
  -- ISSUED: nur Stornierung (und der aktualisierte Zeitstempel) ist zulaessig
  IF NEW.status NOT IN ('ISSUED', 'CANCELLED')
     OR NEW.number IS DISTINCT FROM OLD.number OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name OR NEW.recipient_street IS DISTINCT FROM OLD.recipient_street
     OR NEW.recipient_postal_code IS DISTINCT FROM OLD.recipient_postal_code OR NEW.recipient_city IS DISTINCT FROM OLD.recipient_city
     OR NEW.recipient_ref IS DISTINCT FROM OLD.recipient_ref OR NEW.service_date IS DISTINCT FROM OLD.service_date OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
     OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.intro_text IS DISTINCT FROM OLD.intro_text OR NEW.footer_text IS DISTINCT FROM OLD.footer_text
     OR NEW.net_cents <> OLD.net_cents OR NEW.vat_cents <> OLD.vat_cents OR NEW.gross_cents <> OLD.gross_cents
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR NEW.issued_by_id IS DISTINCT FROM OLD.issued_by_id THEN
    RAISE EXCEPTION 'Ausgestellte Rechnungen sind unveraenderlich (nur Stornierung moeglich)' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_immutable BEFORE UPDATE OR DELETE ON "invoices" FOR EACH ROW EXECUTE FUNCTION ing_invoice_immutable();

CREATE OR REPLACE FUNCTION ing_invoice_items_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st "InvoiceStatus"; inv text;
BEGIN
  inv := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  SELECT status INTO st FROM invoices WHERE id = inv;
  IF st IS NOT NULL AND st <> 'DRAFT' THEN RAISE EXCEPTION 'Positionen einer ausgestellten Rechnung sind unveraenderlich' USING ERRCODE = '23000'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER invoice_items_guard BEFORE INSERT OR UPDATE OR DELETE ON "invoice_items" FOR EACH ROW EXECUTE FUNCTION ing_invoice_items_guard();

-- Zahlungen werden nie gelöscht und nie in Betrag/Datum geändert; nur die Stornierung (reversed_*) darf gesetzt werden.
CREATE OR REPLACE FUNCTION ing_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Zahlungen koennen nicht geloescht werden (bitte stornieren)' USING ERRCODE = '23000'; END IF;
  IF NEW.amount_cents <> OLD.amount_cents OR NEW.paid_on <> OLD.paid_on OR NEW.invoice_id <> OLD.invoice_id OR OLD.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Zahlungen sind unveraenderlich (nur Stornierung moeglich)' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payments_guard BEFORE UPDATE OR DELETE ON "payments" FOR EACH ROW EXECUTE FUNCTION ing_payment_guard();

SELECT public.ing_harden_public();
