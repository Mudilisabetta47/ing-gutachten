-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SENT');

-- CreateTable
CREATE TABLE "report_counters" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "content" JSONB NOT NULL,
    "save_counter" INTEGER NOT NULL DEFAULT 0,
    "author_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_by_id" TEXT,
    "sent_to" TEXT,
    "sent_channel" TEXT,
    "sent_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_versions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "document_id" TEXT,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_comments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "chapter_key" TEXT,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "author_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_blocks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "text_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_number_key" ON "reports"("number");

-- CreateIndex
CREATE INDEX "reports_case_id_idx" ON "reports"("case_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "report_versions_report_id_revision_idx" ON "report_versions"("report_id", "revision");

-- CreateIndex
CREATE INDEX "report_comments_report_id_idx" ON "report_comments"("report_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "reports" ADD CONSTRAINT "reports_sent_chk" CHECK ("status" <> 'SENT' OR "sent_at" IS NOT NULL);
ALTER TABLE "reports" ADD CONSTRAINT "reports_approved_chk" CHECK ("status" NOT IN ('APPROVED', 'SENT') OR "approved_at" IS NOT NULL);
-- Eine Prüfung und ein Kommentar brauchen Text
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_body_chk" CHECK (length(btrim("body")) > 0);

SELECT public.ing_harden_public();
