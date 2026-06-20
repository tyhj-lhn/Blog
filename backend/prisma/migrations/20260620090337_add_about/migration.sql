-- CreateTable
CREATE TABLE "about" (
    "id" SERIAL NOT NULL,
    "greetingTitle" VARCHAR(100) NOT NULL DEFAULT '你好',
    "greetingContent" TEXT NOT NULL DEFAULT '欢迎来到 MemoryStory。',
    "aboutTitle" VARCHAR(100) NOT NULL DEFAULT '关于这个博客',
    "aboutContent" TEXT NOT NULL DEFAULT '从事软件开发，热爱技术与写作。',
    "email" VARCHAR(255),
    "github" VARCHAR(255),
    "location" VARCHAR(100),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_pkey" PRIMARY KEY ("id")
);
