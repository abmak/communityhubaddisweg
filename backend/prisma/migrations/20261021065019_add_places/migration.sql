-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('CINEMA', 'THEATRE', 'HOTEL', 'HIKING', 'CAFE', 'RESTAURANT');

-- DropIndex
DROP INDEX "Post_body_trgm_idx";

-- DropIndex
DROP INDEX "Post_title_trgm_idx";

-- DropIndex
DROP INDEX "User_displayName_trgm_idx";

-- DropIndex
DROP INDEX "User_username_trgm_idx";

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PlaceKind" NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "address" TEXT,
    "description" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "priceLevel" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highlight" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_slug_key" ON "Place"("slug");

-- CreateIndex
CREATE INDEX "Place_kind_city_idx" ON "Place"("kind", "city");

-- CreateIndex
CREATE INDEX "Place_city_rating_idx" ON "Place"("city", "rating" DESC);

-- CreateIndex
CREATE INDEX "Place_featured_idx" ON "Place"("featured");
