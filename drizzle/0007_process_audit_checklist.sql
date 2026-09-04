CREATE TYPE "public"."ProcessAuditAnswerType" AS ENUM('CUMPLE_COMPLETO', 'CUMPLE_PARCIAL', 'CUMPLE_MINIMO', 'NO_CUMPLE');--> statement-breakpoint
CREATE TABLE "ProcessAudit" (
	"id" text PRIMARY KEY NOT NULL,
	"areaId" text NOT NULL,
	"role" text NOT NULL,
	"stationName" text NOT NULL,
	"employeeId" text,
	"employeeNumber" text,
	"employeeName" text,
	"shift" text,
	"auditDate" date NOT NULL,
	"category1Score" integer,
	"category2Score" integer,
	"category3Score" integer,
	"category4Score" integer,
	"category5Score" integer,
	"category6Score" integer,
	"category7Score" integer,
	"totalScore" integer NOT NULL,
	"notes" text,
	"createdByUserId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProcessAuditAnswer" (
	"id" text PRIMARY KEY NOT NULL,
	"auditId" text NOT NULL,
	"category" integer NOT NULL,
	"criterionId" text NOT NULL,
	"answer" "ProcessAuditAnswerType" NOT NULL,
	"score" integer NOT NULL,
	"observation" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ProcessAudit" ADD CONSTRAINT "ProcessAudit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ProcessAudit" ADD CONSTRAINT "ProcessAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ProcessAuditAnswer" ADD CONSTRAINT "ProcessAuditAnswer_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "public"."ProcessAudit"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ProcessAudit_areaId_auditDate_idx" ON "ProcessAudit" USING btree ("areaId" text_ops,"auditDate" date_ops);--> statement-breakpoint
CREATE INDEX "ProcessAuditAnswer_auditId_idx" ON "ProcessAuditAnswer" USING btree ("auditId" text_ops);
