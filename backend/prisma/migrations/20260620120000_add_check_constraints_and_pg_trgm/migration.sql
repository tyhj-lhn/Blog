-- CHECK: like_count must be >= 0
ALTER TABLE "posts" ADD CONSTRAINT "posts_like_count_check" CHECK ("like_count" >= 0);

-- CHECK: wallpaper type must be 'image' or 'video'
ALTER TABLE "wallpaper" ADD CONSTRAINT "wallpaper_type_check" CHECK ("type" IN ('image', 'video'));

-- pg_trgm extension for full-text search (trigram similarity)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- GiN trigram indexes for search performance on posts
CREATE INDEX "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "posts_content_trgm_idx" ON "posts" USING GIN ("content" gin_trgm_ops);

-- GiN trigram index for comment search (admin management page)
CREATE INDEX "comments_username_trgm_idx" ON "comments" USING GIN ("username" gin_trgm_ops);
CREATE INDEX "comments_content_trgm_idx" ON "comments" USING GIN ("content" gin_trgm_ops);
