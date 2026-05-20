CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "stock_quantity" INTEGER,
    "currency" TEXT DEFAULT 'BRL',
    "sku" TEXT,
    "category_id" TEXT,
    "category_name" TEXT,
    "attributes" JSONB,
    "logistics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "external_listing_id" TEXT,
    "external_url" TEXT,
    "error_message" TEXT,
    "published_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketplace_listings_product_id_idx" ON "marketplace_listings"("product_id");
CREATE INDEX "marketplace_listings_platform_idx" ON "marketplace_listings"("platform");
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings"("status");
CREATE INDEX "marketplace_listings_external_listing_id_idx" ON "marketplace_listings"("external_listing_id");
CREATE INDEX "marketplace_listings_created_at_idx" ON "marketplace_listings"("created_at");

ALTER TABLE "marketplace_listings"
ADD CONSTRAINT "marketplace_listings_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
