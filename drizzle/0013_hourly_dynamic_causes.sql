ALTER TABLE "HourlyProductionEntry" DROP COLUMN "materialVirginLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "materialWarehouseLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "systemLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "internetLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "scannerLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "printerLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "labelsLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "lpnPalletLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "personnelLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "qualityLoss";
--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" DROP COLUMN "otherLoss";
--> statement-breakpoint
CREATE TABLE "HourlyProductionDowntimeCause" (
	"id" text PRIMARY KEY NOT NULL,
	"areaGroupKey" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HourlyProductionIncident" (
	"id" text PRIMARY KEY NOT NULL,
	"entryId" text NOT NULL,
	"causeId" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updatedByUserId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "HourlyProductionDowntimeCause_areaGroupKey_code_key" ON "HourlyProductionDowntimeCause" USING btree ("areaGroupKey" text_ops,"code" text_ops);
--> statement-breakpoint
CREATE INDEX "HourlyProductionDowntimeCause_areaGroupKey_idx" ON "HourlyProductionDowntimeCause" USING btree ("areaGroupKey" text_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "HourlyProductionIncident_entryId_causeId_key" ON "HourlyProductionIncident" USING btree ("entryId" text_ops,"causeId" text_ops);
--> statement-breakpoint
CREATE INDEX "HourlyProductionIncident_causeId_idx" ON "HourlyProductionIncident" USING btree ("causeId" text_ops);
--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."HourlyProductionEntry"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "public"."HourlyProductionDowntimeCause"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
