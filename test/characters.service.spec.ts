import { CharacterGender, CharacterStatus } from '@prisma/client';

import { CharactersService } from '../src/characters/characters.service';

describe('CharactersService', () => {
  const items = [
    {
      id: 'char_test',
      image: 'https://i.pravatar.cc/512?u=test',
      name: 'Test Character',
      status: CharacterStatus.ALIVE,
      gender: CharacterGender.FEMALE,
      description: 'A searchable pilot.',
    },
  ];

  const createPrismaMock = () => {
    const prisma = {
      character: {
        findMany: jest.fn((args: unknown) => ({ query: 'findMany', args })),
        count: jest.fn((args: unknown) => ({ query: 'count', args })),
      },
      $transaction: jest.fn(async () => [items, 51]),
    };

    return prisma;
  };

  it('returns paginated characters with defaults', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    const result = await service.findMany();

    expect(prisma.character.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    });
    expect(prisma.character.count).toHaveBeenCalledWith({ where: {} });
    expect(result).toEqual({
      items,
      totalCount: 51,
      pageInfo: {
        skip: 0,
        take: 20,
        hasNextPage: true,
      },
    });
  });

  it('applies a status filter', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    await service.findMany({ status: CharacterStatus.DEAD });

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: CharacterStatus.DEAD },
      }),
    );
  });

  it('applies a gender filter', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    await service.findMany({ gender: CharacterGender.UNKNOWN });

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gender: CharacterGender.UNKNOWN },
      }),
    );
  });

  it('combines status and gender filters', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    await service.findMany({
      status: CharacterStatus.ALIVE,
      gender: CharacterGender.MALE,
    });

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: CharacterStatus.ALIVE,
          gender: CharacterGender.MALE,
        },
      }),
    );
  });

  it('searches by name or description case-insensitively', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    await service.findMany({ search: '  pilot  ' });

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'pilot', mode: 'insensitive' } },
            { description: { contains: 'pilot', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('ignores an empty search string', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    await service.findMany({ search: '   ' });

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('caps pagination take at 50', async () => {
    const prisma = createPrismaMock();
    const service = new CharactersService(prisma as never);

    const result = await service.findMany(undefined, { skip: 10, take: 500 });

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 50,
      }),
    );
    expect(result.pageInfo).toEqual({
      skip: 10,
      take: 50,
      hasNextPage: false,
    });
  });
});
