DROP TABLE "AuditEvaluation";--> statement-breakpoint
CREATE TABLE "FiveSAudit" (
	"id" text PRIMARY KEY NOT NULL,
	"areaId" text NOT NULL,
	"stationName" text,
	"employeeId" text,
	"employeeNumber" text,
	"employeeName" text,
	"shift" text,
	"auditDate" date NOT NULL,
	"s1Score" integer NOT NULL,
	"s2Score" integer NOT NULL,
	"s3Score" integer NOT NULL,
	"s4Score" integer NOT NULL,
	"s5Score" integer NOT NULL,
	"totalScore" integer NOT NULL,
	"notes" text,
	"createdByUserId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FiveSAuditAnswer" (
	"id" text PRIMARY KEY NOT NULL,
	"auditId" text NOT NULL,
	"category" text NOT NULL,
	"criterionId" text NOT NULL,
	"answer" "FiveSClassification" NOT NULL,
	"score" integer NOT NULL,
	"observation" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "FiveSAudit" ADD CONSTRAINT "FiveSAudit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FiveSAudit" ADD CONSTRAINT "FiveSAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FiveSAuditAnswer" ADD CONSTRAINT "FiveSAuditAnswer_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "public"."FiveSAudit"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "FiveSAudit_areaId_auditDate_idx" ON "FiveSAudit" USING btree ("areaId" text_ops,"auditDate" date_ops);--> statement-breakpoint
CREATE INDEX "FiveSAudit_areaId_stationName_idx" ON "FiveSAudit" USING btree ("areaId" text_ops,"stationName" text_ops);--> statement-breakpoint
CREATE INDEX "FiveSAuditAnswer_auditId_idx" ON "FiveSAuditAnswer" USING btree ("auditId" text_ops);
