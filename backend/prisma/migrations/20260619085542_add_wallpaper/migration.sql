-- CreateTable
CREATE TABLE "wallpaper" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallpaper_pkey" PRIMARY KEY ("id")
);
