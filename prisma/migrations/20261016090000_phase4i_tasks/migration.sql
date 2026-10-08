-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('TASK', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "call_direction" "CallDirection",
ADD COLUMN     "call_outcome" TEXT,
ADD COLUMN     "call_phone" TEXT,
ADD COLUMN     "external" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mention_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "kind" "TaskKind" NOT NULL DEFAULT 'TASK',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "due_date" DATE,
    "assignee_id" TEXT,
    "created_by_id" TEXT,
    "case_id" TEXT,
    "lead_id" TEXT,
    "customer_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "snooze_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_due_date_idx" ON "tasks"("assignee_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_status_due_date_idx" ON "tasks"("status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_case_id_idx" ON "tasks"("case_id");

-- CreateIndex
CREATE INDEX "tasks_lead_id_idx" ON "tasks"("lead_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Konsistenz: Wiedervorlagen haben immer einen Fälligkeitstag; erledigte Aufgaben tragen Zeitpunkt, offene nicht.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_followup_due_chk" CHECK (kind <> 'FOLLOW_UP' OR due_date IS NOT NULL);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_chk" CHECK ((status = 'DONE') = (completed_at IS NOT NULL) OR status = 'CANCELLED');
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_chk" CHECK (char_length(btrim(title)) > 0);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_single_ref_chk" CHECK (num_nonnulls(case_id, lead_id, customer_id) <= 1);
ALTER TABLE "notes" ADD CONSTRAINT "notes_call_chk" CHECK (kind = 'PHONE_CALL' OR (call_direction IS NULL AND call_phone IS NULL AND call_outcome IS NULL));

SELECT public.ing_harden_public();
