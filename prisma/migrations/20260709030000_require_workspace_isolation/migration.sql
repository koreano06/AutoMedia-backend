-- Ensure there is at least one workspace available for backfill.
INSERT INTO "workspaces" ("id", "name", "slug", "created_at", "updated_at")
SELECT 'workspace_automedia', 'AutoMedia', 'automedia', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = 'workspace_automedia')
  AND NOT EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = 'automedia');

-- Backfill missing workspace ids using the default workspace when available,
-- otherwise falling back to the oldest existing workspace.
WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "users"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "products"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "media_assets"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "posts"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "comments"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "jobs"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "platform_accounts"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "marketplace_listings"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "sales_orders"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

WITH "fallback_workspace" AS (
  SELECT "id"
  FROM "workspaces"
  WHERE "id" = 'workspace_automedia'
  UNION ALL
  SELECT "id"
  FROM "workspaces"
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "expenses"
SET "workspace_id" = (SELECT "id" FROM "fallback_workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

CREATE INDEX IF NOT EXISTS "users_workspace_id_idx" ON "users"("workspace_id");
CREATE INDEX IF NOT EXISTS "products_workspace_id_idx" ON "products"("workspace_id");
CREATE INDEX IF NOT EXISTS "media_assets_workspace_id_idx" ON "media_assets"("workspace_id");
CREATE INDEX IF NOT EXISTS "posts_workspace_id_idx" ON "posts"("workspace_id");
CREATE INDEX IF NOT EXISTS "comments_workspace_id_idx" ON "comments"("workspace_id");
CREATE INDEX IF NOT EXISTS "jobs_workspace_id_idx" ON "jobs"("workspace_id");
CREATE INDEX IF NOT EXISTS "sales_orders_workspace_id_idx" ON "sales_orders"("workspace_id");
CREATE INDEX IF NOT EXISTS "expenses_workspace_id_idx" ON "expenses"("workspace_id");
CREATE INDEX IF NOT EXISTS "marketplace_listings_workspace_id_idx" ON "marketplace_listings"("workspace_id");
CREATE INDEX IF NOT EXISTS "platform_accounts_workspace_id_idx" ON "platform_accounts"("workspace_id");

DROP INDEX IF EXISTS "platform_accounts_platform_key";
CREATE UNIQUE INDEX IF NOT EXISTS "platform_accounts_workspace_id_platform_key" ON "platform_accounts"("workspace_id", "platform");

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_workspace_id_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_workspace_id_fkey";
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_workspace_id_fkey";
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_workspace_id_fkey";
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_workspace_id_fkey";
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_workspace_id_fkey";
ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "sales_orders_workspace_id_fkey";
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_workspace_id_fkey";
ALTER TABLE "marketplace_listings" DROP CONSTRAINT IF EXISTS "marketplace_listings_workspace_id_fkey";
ALTER TABLE "platform_accounts" DROP CONSTRAINT IF EXISTS "platform_accounts_workspace_id_fkey";

ALTER TABLE "users" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "media_assets" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "comments" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "jobs" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "sales_orders" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "marketplace_listings" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "platform_accounts" ALTER COLUMN "workspace_id" SET NOT NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketplace_listings"
  ADD CONSTRAINT "marketplace_listings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_accounts"
  ADD CONSTRAINT "platform_accounts_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
