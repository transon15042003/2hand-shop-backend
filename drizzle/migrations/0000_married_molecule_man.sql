CREATE TYPE "public"."batch_status" AS ENUM('processing', 'active', 'break_even', 'completed');--> statement-breakpoint
CREATE TYPE "public"."cancel_actor" AS ENUM('customer', 'shop', 'system');--> statement-breakpoint
CREATE TYPE "public"."confirm_actor" AS ENUM('shop', 'system');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('not_required', 'pending', 'received', 'forfeited', 'refunded', 'voided');--> statement-breakpoint
CREATE TYPE "public"."item_category" AS ENUM('t_shirts', 'shirts', 'sweaters', 'jackets', 'blazers', 'pants', 'shorts', 'skirts', 'dresses', 'bags', 'scarves', 'hats', 'accessories');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('like_new', 'excellent', 'good', 'fair');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('draft', 'shelf', 'reserved', 'sold');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'shipping', 'completed', 'cancelled', 'returned');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cod');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'refunded');--> statement-breakpoint
CREATE TABLE "batches" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "item_category" NOT NULL,
	"import_date" date NOT NULL,
	"initial_capital" integer NOT NULL,
	"processing_cost" integer DEFAULT 0 NOT NULL,
	"target_margin_percent" integer DEFAULT 30 NOT NULL,
	"status" "batch_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "batches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cash_flow_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" varchar(50),
	"batch_id" varchar(50),
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"token_hash" varchar(128) PRIMARY KEY NOT NULL,
	"customer_id" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_otp" varchar(10),
	"otp_expires_at" timestamp with time zone,
	"default_shipping_address" text,
	"default_shipping_note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "customers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "item_category" NOT NULL,
	"condition" "item_condition" NOT NULL,
	"price" integer NOT NULL,
	"original_price" integer,
	"cost_price" integer,
	"size" varchar(50) NOT NULL,
	"material" varchar(255) NOT NULL,
	"origin" varchar(100),
	"status" "item_status" DEFAULT 'shelf' NOT NULL,
	"batch_id" varchar(50),
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"defect_description" text,
	"defect_images" jsonb DEFAULT '[]'::jsonb,
	"reserved_until" timestamp with time zone,
	"reserved_by_customer_phone" varchar(20),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" varchar(50) NOT NULL,
	"item_id" varchar(50) NOT NULL,
	"price_snapshot" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"order_code" varchar(50) PRIMARY KEY NOT NULL,
	"customer_id" varchar(50),
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"shipping_address" text NOT NULL,
	"customer_note" text,
	"admin_note" text,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"order_status" "order_status" DEFAULT 'new' NOT NULL,
	"subtotal" integer NOT NULL,
	"shipping_fee" integer,
	"default_shipping_fee" integer,
	"freeship_applied" boolean DEFAULT false NOT NULL,
	"total" integer NOT NULL,
	"deposit_amount" integer DEFAULT 0 NOT NULL,
	"deposit_status" "deposit_status" DEFAULT 'not_required' NOT NULL,
	"amount_due" integer NOT NULL,
	"agreed_return_fee" integer DEFAULT 50000 NOT NULL,
	"return_window_days" integer DEFAULT 2 NOT NULL,
	"hold_minutes" integer DEFAULT 30 NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"hold_extended_at" timestamp with time zone,
	"hold_extension_minutes" integer,
	"cancel_reason" text,
	"cancelled_by" "cancel_actor",
	"cancelled_at" timestamp with time zone,
	"confirmed_by" "confirm_actor",
	"confirmed_at" timestamp with time zone,
	"deposit_paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"return_fee" integer,
	"refund_amount" integer,
	"carrier_name" varchar(100),
	"tracking_code" varchar(100),
	"actual_shipping_cost" integer,
	"shipping_margin" integer,
	"policy_accepted_at" timestamp with time zone,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliation_sessions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"carrier" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"total_discrepancy" integer DEFAULT 0 NOT NULL,
	"records" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"deposit_amount" integer DEFAULT 50000 NOT NULL,
	"return_fee" integer DEFAULT 50000 NOT NULL,
	"return_window_days" integer DEFAULT 2 NOT NULL,
	"order_hold_minutes" integer DEFAULT 30 NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"shop_phone" varchar(20) DEFAULT '0900000000' NOT NULL,
	"shop_zalo" varchar(100) DEFAULT '0900000000' NOT NULL,
	"shop_messenger_url" varchar(255),
	"bank_name" varchar(100) DEFAULT 'Vietcombank' NOT NULL,
	"bank_account_number" varchar(50) DEFAULT '0000000000' NOT NULL,
	"bank_account_holder" varchar(100) DEFAULT 'CHU SHOP' NOT NULL,
	"bank_qr_image_url" varchar(500),
	"shipping_fee_presets" jsonb DEFAULT '[20000,30000]'::jsonb NOT NULL,
	"default_shipping_fee" integer DEFAULT 30000 NOT NULL,
	"freeship_min_items" integer DEFAULT 4 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_order_code_orders_order_code_fk" FOREIGN KEY ("order_code") REFERENCES "public"."orders"("order_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_code_orders_order_code_fk" FOREIGN KEY ("order_code") REFERENCES "public"."orders"("order_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;