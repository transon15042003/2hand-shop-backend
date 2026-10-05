-- Admin multi-account + RBAC
CREATE TYPE "public"."admin_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"role" "admin_role" DEFAULT 'staff' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
