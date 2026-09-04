CREATE TABLE "DowntimeRecord" (
	"id" text PRIMARY KEY NOT NULL,
	"areaId" text NOT NULL,
	"stationName" text,
	"reasonKey" text NOT NULL,
	"durationMinutes" integer NOT NULL,
	"shift" text,
	"notes" text,
	"createdByUserId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DowntimeRecord" ADD CONSTRAINT "DowntimeRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "DowntimeRecord_areaId_createdAt_idx" ON "DowntimeRecord" USING btree ("areaId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "DowntimeRecord_reasonKey_idx" ON "DowntimeRecord" USING btree ("reasonKey" text_ops);
