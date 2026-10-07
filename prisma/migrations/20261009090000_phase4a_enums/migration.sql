-- Phase 4a: neue Enum-Werte (muessen vor ihrer Verwendung committet sein -> eigene Migration)
-- AlterEnum
ALTER TYPE "AppointmentKind" ADD VALUE 'REINSPECTION';
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "CaseStatus" ADD VALUE 'CALCULATION';
ALTER TYPE "CaseStatus" ADD VALUE 'REPORT_DRAFT';
ALTER TYPE "CaseStatus" ADD VALUE 'REVIEW';
ALTER TYPE "CaseStatus" ADD VALUE 'APPROVED';
ALTER TYPE "CaseStatus" ADD VALUE 'SENT';
ALTER TYPE "CaseStatus" ADD VALUE 'BILLING';
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "DocumentCategory" ADD VALUE 'ASSIGNMENT_OF_CLAIM';
ALTER TYPE "DocumentCategory" ADD VALUE 'ACCIDENT_REPORT';
ALTER TYPE "DocumentCategory" ADD VALUE 'POLICE_REPORT';
ALTER TYPE "DocumentCategory" ADD VALUE 'WORKSHOP_DOCUMENT';
ALTER TYPE "DocumentCategory" ADD VALUE 'RESIDUAL_OFFER';
ALTER TYPE "DocumentCategory" ADD VALUE 'CALCULATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'INVOICE';
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "PhotoCategory" ADD VALUE 'FRONT';
ALTER TYPE "PhotoCategory" ADD VALUE 'REAR';
ALTER TYPE "PhotoCategory" ADD VALUE 'LEFT';
ALTER TYPE "PhotoCategory" ADD VALUE 'RIGHT';
ALTER TYPE "PhotoCategory" ADD VALUE 'PRIOR_DAMAGE';
ALTER TYPE "PhotoCategory" ADD VALUE 'ENGINE_BAY';
ALTER TYPE "PhotoCategory" ADD VALUE 'TYRES';
ALTER TYPE "PhotoCategory" ADD VALUE 'RIMS';
ALTER TYPE "PhotoCategory" ADD VALUE 'DOCUMENTS';
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'REVIEWER';
