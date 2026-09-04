CREATE TABLE "SortingSession" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"shift" text NOT NULL,
	"areaId" text NOT NULL,
	"standardRate" integer NOT NULL,
	"lossUnit" "HourlyMeasurementType" DEFAULT 'PIECES' NOT NULL,
	"status" "HourlySessionStatus" DEFAULT 'ABIERTO' NOT NULL,
	"createdByUserId" text NOT NULL,
	"updatedByUserId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SortingEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"standardQty" integer NOT NULL,
	"actualQty" integer,
	"materialVirginLoss" integer DEFAULT 0 NOT NULL,
	"materialWarehouseLoss" integer DEFAULT 0 NOT NULL,
	"systemLoss" integer DEFAULT 0 NOT NULL,
	"internetLoss" integer DEFAULT 0 NOT NULL,
	"scannerLoss" integer DEFAULT 0 NOT NULL,
	"printerLoss" integer DEFAULT 0 NOT NULL,
	"labelsLoss" integer DEFAULT 0 NOT NULL,
	"lpnPalletLoss" integer DEFAULT 0 NOT NULL,
	"personnelLoss" integer DEFAULT 0 NOT NULL,
	"qualityLoss" integer DEFAULT 0 NOT NULL,
	"otherLoss" integer DEFAULT 0 NOT NULL,
	"observations" text,
	"createdByUserId" text NOT NULL,
	"updatedByUserId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SortingSession" ADD CONSTRAINT "SortingSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SortingSession" ADD CONSTRAINT "SortingSession_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SortingEntry" ADD CONSTRAINT "SortingEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."SortingSession"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SortingEntry" ADD CONSTRAINT "SortingEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SortingEntry" ADD CONSTRAINT "SortingEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "SortingSession_date_shift_areaId_key" ON "SortingSession" USING btree ("date" date_ops,"shift" text_ops,"areaId" text_ops);--> statement-breakpoint
CREATE INDEX "SortingSession_areaId_date_idx" ON "SortingSession" USING btree ("areaId" text_ops,"date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SortingEntry_sessionId_startTime_key" ON "SortingEntry" USING btree ("sessionId" text_ops,"startTime" text_ops);
