import { NotFoundException } from '@nestjs/common';
import { CharacterGender, CharacterStatus } from '@prisma/client';

import { CharactersService } from '../src/characters/characters.service';
import { CharacterSortField, SortDirection } from '../src/characters/models/character.enums';

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
        findUnique: jest.fn(),
        findMany: jest.fn((args: unknown) => ({ query: 'findMany', args })),
        count: jest.fn((args: unknown) => ({ query: 'count', args })),
        groupBy: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (queries: unknown[]) => queries),
    };

    return prisma;
  };

  describe('findOne', () => {
    it('returns a character by id', async () => {
      const prisma = createPrismaMock();
      prisma.character.findUnique.mockResolvedValue(items[0]);
      const service = new CharactersService(prisma as never);

      const result = await service.findOne('char_test');

      expect(result).toEqual(items[0]);
      expect(prisma.character.findUnique).toHaveBeenCalledWith({
        where: { id: 'char_test' },
      });
    });

    it('throws NotFoundException when character does not exist', async () => {
      const prisma = createPrismaMock();
      prisma.character.findUnique.mockResolvedValue(null);
      const service = new CharactersService(prisma as never);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMany', () => {
    const createFindManyMock = () => {
      const prisma = createPrismaMock();
      prisma.$transaction.mockResolvedValue([items, 51]);
      return prisma;
    };

    it('returns paginated characters with defaults', async () => {
      const prisma = createFindManyMock();
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
      const prisma = createFindManyMock();
      const service = new CharactersService(prisma as never);

      await service.findMany({ status: CharacterStatus.DEAD });

      expect(prisma.character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CharacterStatus.DEAD },
        }),
      );
    });

    it('applies a gender filter', async () => {
      const prisma = createFindManyMock();
      const service = new CharactersService(prisma as never);

      await service.findMany({ gender: CharacterGender.UNKNOWN });

      expect(prisma.character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { gender: CharacterGender.UNKNOWN },
        }),
      );
    });

    it('combines status and gender filters', async () => {
      const prisma = createFindManyMock();
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
      const prisma = createFindManyMock();
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
      const prisma = createFindManyMock();
      const service = new CharactersService(prisma as never);

      await service.findMany({ search: '   ' });

      expect(prisma.character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('caps pagination take at 50', async () => {
      const prisma = createFindManyMock();
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

    it('sorts by the given field and direction', async () => {
      const prisma = createFindManyMock();
      const service = new CharactersService(prisma as never);

      await service.findMany(undefined, undefined, {
        field: CharacterSortField.STATUS,
        direction: SortDirection.DESC,
      });

      expect(prisma.character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ status: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('defaults sorting to name ascending', async () => {
      const prisma = createFindManyMock();
      const service = new CharactersService(prisma as never);

      await service.findMany();

      expect(prisma.character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a new character', async () => {
      const prisma = createPrismaMock();
      const newChar = { ...items[0], id: 'char_new' };
      prisma.character.create.mockResolvedValue(newChar);
      const service = new CharactersService(prisma as never);

      const result = await service.create({
        name: 'Test Character',
        image: 'https://i.pravatar.cc/512?u=test',
        status: CharacterStatus.ALIVE,
        gender: CharacterGender.FEMALE,
        description: 'A searchable pilot.',
      });

      expect(result).toEqual(newChar);
      expect(prisma.character.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Character',
          image: 'https://i.pravatar.cc/512?u=test',
          status: CharacterStatus.ALIVE,
          gender: CharacterGender.FEMALE,
          description: 'A searchable pilot.',
        },
      });
    });
  });

  describe('update', () => {
    it('updates an existing character', async () => {
      const prisma = createPrismaMock();
      const updated = { ...items[0], name: 'Updated Name' };
      prisma.character.findUnique.mockResolvedValue(items[0]);
      prisma.character.update.mockResolvedValue(updated);
      const service = new CharactersService(prisma as never);

      const result = await service.update('char_test', { name: 'Updated Name' });

      expect(result).toEqual(updated);
      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'char_test' },
        data: { name: 'Updated Name' },
      });
    });

    it('throws NotFoundException when updating non-existent character', async () => {
      const prisma = createPrismaMock();
      prisma.character.findUnique.mockResolvedValue(null);
      const service = new CharactersService(prisma as never);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.character.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an existing character', async () => {
      const prisma = createPrismaMock();
      prisma.character.findUnique.mockResolvedValue(items[0]);
      prisma.character.delete.mockResolvedValue(items[0]);
      const service = new CharactersService(prisma as never);

      const result = await service.delete('char_test');

      expect(result).toEqual({ id: 'char_test', success: true });
      expect(prisma.character.delete).toHaveBeenCalledWith({
        where: { id: 'char_test' },
      });
    });

    it('throws NotFoundException when deleting non-existent character', async () => {
      const prisma = createPrismaMock();
      prisma.character.findUnique.mockResolvedValue(null);
      const service = new CharactersService(prisma as never);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.character.delete).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns aggregated character statistics', async () => {
      const prisma = createPrismaMock();
      prisma.$transaction.mockResolvedValue([
        24,
        [
          { status: CharacterStatus.ALIVE, _count: { _all: 10 } },
          { status: CharacterStatus.DEAD, _count: { _all: 8 } },
          { status: CharacterStatus.UNKNOWN, _count: { _all: 6 } },
        ],
        [
          { gender: CharacterGender.FEMALE, _count: { _all: 9 } },
          { gender: CharacterGender.MALE, _count: { _all: 9 } },
          { gender: CharacterGender.UNKNOWN, _count: { _all: 6 } },
        ],
      ]);
      const service = new CharactersService(prisma as never);

      const result = await service.getStats();

      expect(result).toEqual({
        totalCount: 24,
        byStatus: [
          { status: CharacterStatus.ALIVE, count: 10 },
          { status: CharacterStatus.DEAD, count: 8 },
          { status: CharacterStatus.UNKNOWN, count: 6 },
        ],
        byGender: [
          { gender: CharacterGender.FEMALE, count: 9 },
          { gender: CharacterGender.MALE, count: 9 },
          { gender: CharacterGender.UNKNOWN, count: 6 },
        ],
      });
    });
  });
});
