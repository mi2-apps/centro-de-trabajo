CREATE TYPE "public"."HourlySessionStatus" AS ENUM('ABIERTO', 'FINALIZADO');--> statement-breakpoint
CREATE TYPE "public"."HourlyMeasurementType" AS ENUM('MINUTES', 'PIECES');--> statement-breakpoint
CREATE TABLE "HourlyProductionSession" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"shift" text NOT NULL,
	"areaId" text NOT NULL,
	"standardRate" integer NOT NULL,
	"status" "HourlySessionStatus" DEFAULT 'ABIERTO' NOT NULL,
	"createdByUserId" text NOT NULL,
	"updatedByUserId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HourlyProductionEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"standardQty" integer NOT NULL,
	"actualQty" integer,
	"createdByUserId" text NOT NULL,
	"updatedByUserId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HourlyProductionDowntimeCause" (
	"id" text PRIMARY KEY NOT NULL,
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
	"measurementType" "HourlyMeasurementType" NOT NULL,
	"value" integer NOT NULL,
	"customDescription" text,
	"notes" text,
	"createdByUserId" text NOT NULL,
	"updatedByUserId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "HourlyProductionSession" ADD CONSTRAINT "HourlyProductionSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionSession" ADD CONSTRAINT "HourlyProductionSession_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD CONSTRAINT "HourlyProductionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."HourlyProductionSession"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD CONSTRAINT "HourlyProductionEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionEntry" ADD CONSTRAINT "HourlyProductionEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."HourlyProductionEntry"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "public"."HourlyProductionDowntimeCause"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HourlyProductionIncident" ADD CONSTRAINT "HourlyProductionIncident_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "HourlyProductionSession_date_shift_areaId_key" ON "HourlyProductionSession" USING btree ("date" date_ops,"shift" text_ops,"areaId" text_ops);--> statement-breakpoint
CREATE INDEX "HourlyProductionSession_areaId_date_idx" ON "HourlyProductionSession" USING btree ("areaId" text_ops,"date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "HourlyProductionEntry_sessionId_startTime_key" ON "HourlyProductionEntry" USING btree ("sessionId" text_ops,"startTime" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "HourlyProductionDowntimeCause_code_key" ON "HourlyProductionDowntimeCause" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "HourlyProductionIncident_entryId_idx" ON "HourlyProductionIncident" USING btree ("entryId" text_ops);--> statement-breakpoint
CREATE INDEX "HourlyProductionIncident_causeId_idx" ON "HourlyProductionIncident" USING btree ("causeId" text_ops);--> statement-breakpoint
INSERT INTO "HourlyProductionDowntimeCause" ("id", "name", "code", "sortOrder") VALUES
('hphcause00000000000000001', 'Falta de material virgen', 'falta-material-virgen', 10),
('hphcause00000000000000002', 'Falta de material de almacén', 'falta-material-almacen', 20),
('hphcause00000000000000003', 'Falla de sistema', 'falla-sistema', 30),
('hphcause00000000000000004', 'Internet lento', 'internet-lento', 40),
('hphcause00000000000000005', 'Falla de escáner', 'falla-escaner', 50),
('hphcause00000000000000006', 'Falla de impresora', 'falla-impresora', 60),
('hphcause00000000000000007', 'Falta de etiquetas', 'falta-etiquetas', 70),
('hphcause00000000000000008', 'Problema de LPN / Pallet', 'problema-lpn-pallet', 80),
('hphcause00000000000000009', 'Falta de personal', 'falta-personal', 90),
('hphcause00000000000000010', 'Cambio de modelo', 'cambio-modelo', 100),
('hphcause00000000000000011', 'Calidad', 'calidad', 110),
('hphcause00000000000000013', 'Conveyor saturado', 'conveyor-saturado', 115),
('hphcause00000000000000012', 'Otra', 'otra', 120);
