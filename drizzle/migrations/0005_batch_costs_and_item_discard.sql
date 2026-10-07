ALTER TYPE "public"."item_status" ADD VALUE IF NOT EXISTS 'discarded';--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "shipping_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "other_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "discard_reason" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "discarded_at" timestamp with time zone;
