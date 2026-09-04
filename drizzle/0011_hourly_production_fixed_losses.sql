DROP TABLE "HourlyProductionIncident";--> statement-breakpoint
DROP TABLE "HourlyProductionDowntimeCause";--> statement-breakpoint
ALTER TABLE "HourlyProductionSession" ADD COLUMN "lossUnit" "HourlyMeasurementType" DEFAULT 'PIECES' NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "materialVirginLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "materialWarehouseLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "systemLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "internetLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "scannerLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "printerLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "labelsLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "lpnPalletLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "personnelLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "qualityLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "otherLoss" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD COLUMN "observations" text;
