import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { characterSeedData, userSeedData } from './seed-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // ─── Seed Users ──────────────────────────────────────────────
  for (const user of userSeedData) {
    const hashedPassword = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword,
      },
      create: {
        id: user.id,
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
      },
    });
  }

  console.log(`Seeded ${userSeedData.length} users:`);
  for (const user of userSeedData) {
    console.log(`  → ${user.email} (${user.role}) — password: ${user.password}`);
  }

  // ─── Seed Characters ─────────────────────────────────────────
  await prisma.$transaction(
    characterSeedData.map((character) =>
      prisma.character.upsert({
        where: { id: character.id },
        update: {
          image: character.image,
          name: character.name,
          status: character.status,
          gender: character.gender,
          description: character.description,
        },
        create: character,
      }),
    ),
  );

  console.log(`Seeded ${characterSeedData.length} characters.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
