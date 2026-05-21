CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT,
    "customer_email" TEXT,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "external_order_id" TEXT,
    "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "spent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_orders_platform_idx" ON "sales_orders"("platform");
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");
CREATE INDEX "sales_orders_sold_at_idx" ON "sales_orders"("sold_at");
CREATE INDEX "sales_orders_external_order_id_idx" ON "sales_orders"("external_order_id");
CREATE INDEX "sales_order_items_order_id_idx" ON "sales_order_items"("order_id");
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");
CREATE INDEX "expenses_spent_at_idx" ON "expenses"("spent_at");

ALTER TABLE "sales_order_items"
ADD CONSTRAINT "sales_order_items_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_order_items"
ADD CONSTRAINT "sales_order_items_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
