-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('GENERAL', 'CLIP', 'ACHIEVEMENT', 'DEBATE');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "gameId" TEXT,
ADD COLUMN     "kind" "PostKind" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "rank" VARCHAR(40),
ADD COLUMN     "role" VARCHAR(40);

-- CreateIndex
CREATE INDEX "posts_kind_createdAt_idx" ON "posts"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
