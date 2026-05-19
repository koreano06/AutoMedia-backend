-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "store_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input_source" TEXT,
    "source_url" TEXT,
    "image_url" TEXT,
    "uploaded_image_url" TEXT,
    "category" TEXT,
    "description" TEXT,
    "brand" TEXT,
    "price" DECIMAL(12,2),
    "cost_price" DECIMAL(12,2),
    "margin_percent" DOUBLE PRECISION,
    "sku" TEXT,
    "internal_code" TEXT,
    "supplier_name" TEXT,
    "supplier_contact" TEXT,
    "supplier_lead_time_days" INTEGER,
    "stock_quantity" INTEGER DEFAULT 0,
    "min_stock" INTEGER DEFAULT 0,
    "marketplace_origin" TEXT,
    "currency" TEXT DEFAULT 'BRL',
    "product_url" TEXT,
    "affiliate_url" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributes" JSONB,
    "analysis_summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "media_count" INTEGER NOT NULL DEFAULT 0,
    "posts_published" INTEGER NOT NULL DEFAULT 0,
    "videos_generated" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_analyses" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "provider" TEXT,
    "input_type" TEXT,
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'image',
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'collected',
    "source" TEXT,
    "source_url" TEXT,
    "url" TEXT,
    "thumbnail_url" TEXT,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "caption" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quality_score" DOUBLE PRECISION,
    "duration" TEXT,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "previous_status" TEXT,
    "rejection_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_collection_sources" (
    "id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'collected',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_collection_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "previous_status" TEXT,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "media_asset_id" TEXT,
    "product_name" TEXT,
    "platform" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "external_post_id" TEXT,
    "external_url" TEXT,
    "error_message" TEXT,
    "engagement_likes" INTEGER NOT NULL DEFAULT 0,
    "engagement_comments" INTEGER NOT NULL DEFAULT 0,
    "engagement_shares" INTEGER NOT NULL DEFAULT 0,
    "engagement_reach" INTEGER NOT NULL DEFAULT 0,
    "thumbnail_url" TEXT,
    "campaign_name" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_metrics" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DOUBLE PRECISION,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT,
    "external_comment_id" TEXT,
    "author" TEXT,
    "content" TEXT,
    "platform" TEXT,
    "is_purchase_intent" BOOLEAN NOT NULL DEFAULT false,
    "auto_replied" BOOLEAN NOT NULL DEFAULT false,
    "reply_content" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reply_logs" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "content" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reply_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" TEXT NOT NULL DEFAULT 'automation_settings',
    "auto_reply" BOOLEAN NOT NULL DEFAULT true,
    "auto_schedule" BOOLEAN NOT NULL DEFAULT true,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "random_schedule" BOOLEAN NOT NULL DEFAULT true,
    "purchase_keywords" TEXT[] DEFAULT ARRAY['eu quero', 'quanto custa', 'como comprar', 'onde comprar', 'link do produto']::TEXT[],
    "posting_start" TEXT NOT NULL DEFAULT '08:00',
    "posting_end" TEXT NOT NULL DEFAULT '22:00',
    "enabled_platforms" TEXT[] DEFAULT ARRAY['instagram', 'tiktok', 'facebook', 'youtube', 'shopee', 'mercadolivre']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "title" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "product_id" TEXT,
    "media_asset_id" TEXT,
    "post_id" TEXT,
    "result_url" TEXT,
    "error_message" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "products"("created_at");

-- CreateIndex
CREATE INDEX "product_analyses_product_id_idx" ON "product_analyses"("product_id");

-- CreateIndex
CREATE INDEX "media_assets_product_id_idx" ON "media_assets"("product_id");

-- CreateIndex
CREATE INDEX "media_assets_type_idx" ON "media_assets"("type");

-- CreateIndex
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");

-- CreateIndex
CREATE INDEX "media_assets_created_at_idx" ON "media_assets"("created_at");

-- CreateIndex
CREATE INDEX "media_collection_sources_media_asset_id_idx" ON "media_collection_sources"("media_asset_id");

-- CreateIndex
CREATE INDEX "media_collection_sources_source_type_idx" ON "media_collection_sources"("source_type");

-- CreateIndex
CREATE INDEX "approvals_media_asset_id_idx" ON "approvals"("media_asset_id");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "approvals"("status");

-- CreateIndex
CREATE INDEX "posts_product_id_idx" ON "posts"("product_id");

-- CreateIndex
CREATE INDEX "posts_media_asset_id_idx" ON "posts"("media_asset_id");

-- CreateIndex
CREATE INDEX "posts_platform_idx" ON "posts"("platform");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_scheduled_at_idx" ON "posts"("scheduled_at");

-- CreateIndex
CREATE INDEX "posts_published_at_idx" ON "posts"("published_at");

-- CreateIndex
CREATE INDEX "post_metrics_post_id_idx" ON "post_metrics"("post_id");

-- CreateIndex
CREATE INDEX "post_metrics_captured_at_idx" ON "post_metrics"("captured_at");

-- CreateIndex
CREATE INDEX "comments_post_id_idx" ON "comments"("post_id");

-- CreateIndex
CREATE INDEX "comments_platform_idx" ON "comments"("platform");

-- CreateIndex
CREATE INDEX "comments_is_purchase_intent_idx" ON "comments"("is_purchase_intent");

-- CreateIndex
CREATE INDEX "comments_auto_replied_idx" ON "comments"("auto_replied");

-- CreateIndex
CREATE INDEX "comments_detected_at_idx" ON "comments"("detected_at");

-- CreateIndex
CREATE INDEX "comment_reply_logs_comment_id_idx" ON "comment_reply_logs"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_platform_key" ON "platform_accounts"("platform");

-- CreateIndex
CREATE INDEX "platform_accounts_status_idx" ON "platform_accounts"("status");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_product_id_idx" ON "jobs"("product_id");

-- CreateIndex
CREATE INDEX "jobs_media_asset_id_idx" ON "jobs"("media_asset_id");

-- CreateIndex
CREATE INDEX "jobs_post_id_idx" ON "jobs"("post_id");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "product_analyses" ADD CONSTRAINT "product_analyses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_collection_sources" ADD CONSTRAINT "media_collection_sources_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reply_logs" ADD CONSTRAINT "comment_reply_logs_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

