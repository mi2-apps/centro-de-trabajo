CREATE TYPE "public"."EquipmentStatus" AS ENUM('OPERATIVO', 'DANADO', 'EN_REPARACION', 'BAJA');--> statement-breakpoint
CREATE TYPE "public"."EquipmentAuditAnswerType" AS ENUM('CUMPLE', 'CUMPLE_PARCIAL', 'NO_CUMPLE');--> statement-breakpoint
CREATE TABLE "EquipmentItem" (
	"id" text PRIMARY KEY NOT NULL,
	"typeKey" text NOT NULL,
	"areaId" text NOT NULL,
	"stationName" text,
	"code" text,
	"status" "EquipmentStatus" NOT NULL,
	"notes" text,
	"createdByUserId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EquipmentAudit" (
	"id" text PRIMARY KEY NOT NULL,
	"areaId" text NOT NULL,
	"stationName" text,
	"auditDate" date NOT NULL,
	"totalScore" integer NOT NULL,
	"notes" text,
	"createdByUserId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EquipmentAuditAnswer" (
	"id" text PRIMARY KEY NOT NULL,
	"auditId" text NOT NULL,
	"typeKey" text NOT NULL,
	"answer" "EquipmentAuditAnswerType" NOT NULL,
	"score" integer NOT NULL,
	"observation" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EquipmentAudit" ADD CONSTRAINT "EquipmentAudit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EquipmentAuditAnswer" ADD CONSTRAINT "EquipmentAuditAnswer_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "public"."EquipmentAudit"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "EquipmentItem_areaId_createdAt_idx" ON "EquipmentItem" USING btree ("areaId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "EquipmentItem_typeKey_idx" ON "EquipmentItem" USING btree ("typeKey" text_ops);--> statement-breakpoint
CREATE INDEX "EquipmentAudit_areaId_auditDate_idx" ON "EquipmentAudit" USING btree ("areaId" text_ops,"auditDate" date_ops);--> statement-breakpoint
CREATE INDEX "EquipmentAuditAnswer_auditId_idx" ON "EquipmentAuditAnswer" USING btree ("auditId" text_ops);
