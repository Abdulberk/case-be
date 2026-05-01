import { PrismaClient } from '@prisma/client';

import { characterSeedData } from './seed-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
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
