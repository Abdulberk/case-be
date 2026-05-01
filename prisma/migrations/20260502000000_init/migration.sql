CREATE TYPE "CharacterStatus" AS ENUM ('ALIVE', 'DEAD', 'UNKNOWN');

CREATE TYPE "CharacterGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CharacterStatus" NOT NULL DEFAULT 'UNKNOWN',
    "gender" "CharacterGender" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Character_status_idx" ON "Character"("status");

CREATE INDEX "Character_gender_idx" ON "Character"("gender");

CREATE INDEX "Character_name_idx" ON "Character"("name");
