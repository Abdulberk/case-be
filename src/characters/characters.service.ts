import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CharacterSortInput } from './dto/character-sort.input';
import { CharactersFilterInput } from './dto/characters-filter.input';
import { CreateCharacterInput } from './dto/create-character.input';
import { PaginationInput } from './dto/pagination.input';
import { UpdateCharacterInput } from './dto/update-character.input';
import { CharacterConnection } from './models/character-connection.model';
import { CharacterStats } from './models/character-stats.model';
import { CharacterSortField, SortDirection } from './models/character.enums';
import { DeleteResult } from './models/delete-result.model';

@Injectable()
export class CharactersService {
  private static readonly DEFAULT_TAKE = 20;
  private static readonly MAX_TAKE = 50;
  private readonly logger = new Logger(CharactersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<Prisma.CharacterGetPayload<object>> {
    this.logger.debug(`Finding character by id: ${id}`);

    const character = await this.prisma.character.findUnique({ where: { id } });

    if (!character) {
      throw new NotFoundException(`Character with id "${id}" not found`);
    }

    return character;
  }

  async findMany(
    filter?: CharactersFilterInput,
    pagination?: PaginationInput,
    sort?: CharacterSortInput,
  ): Promise<CharacterConnection> {
    const where = this.buildWhere(filter);
    const skip = Math.max(pagination?.skip ?? 0, 0);
    const take = Math.min(
      Math.max(pagination?.take ?? CharactersService.DEFAULT_TAKE, 1),
      CharactersService.MAX_TAKE,
    );
    const orderBy = this.buildOrderBy(sort);

    this.logger.debug(
      `Finding characters — skip: ${skip}, take: ${take}, sort: ${JSON.stringify(orderBy)}`,
    );

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.character.count({ where }),
    ]);

    return {
      items,
      totalCount,
      pageInfo: {
        skip,
        take,
        hasNextPage: skip + take < totalCount,
      },
    };
  }

  async getStats(): Promise<CharacterStats> {
    this.logger.debug('Computing character stats');

    const [totalCount, statusGroups, genderGroups] = await this.prisma.$transaction([
      this.prisma.character.count(),
      this.prisma.character.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.character.groupBy({
        by: ['gender'],
        _count: { _all: true },
        orderBy: { gender: 'asc' },
      }),
    ]);

    return {
      totalCount,
      byStatus: statusGroups.map((group) => ({
        status: group.status,
        count: typeof group._count === 'object' ? (group._count._all ?? 0) : 0,
      })),
      byGender: genderGroups.map((group) => ({
        gender: group.gender,
        count: typeof group._count === 'object' ? (group._count._all ?? 0) : 0,
      })),
    };
  }

  async create(
    input: CreateCharacterInput,
  ): Promise<Prisma.CharacterGetPayload<object>> {
    this.logger.log(`Creating character: ${input.name}`);

    return this.prisma.character.create({ data: input });
  }

  async update(
    id: string,
    input: UpdateCharacterInput,
  ): Promise<Prisma.CharacterGetPayload<object>> {
    this.logger.log(`Updating character: ${id}`);

    await this.findOne(id); // throws NotFoundException if not found

    return this.prisma.character.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string): Promise<DeleteResult> {
    this.logger.log(`Deleting character: ${id}`);

    await this.findOne(id); // throws NotFoundException if not found

    await this.prisma.character.delete({ where: { id } });

    return { id, success: true };
  }

  private buildWhere(filter?: CharactersFilterInput): Prisma.CharacterWhereInput {
    const search = filter?.search?.trim();

    return {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.gender ? { gender: filter.gender } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sort?: CharacterSortInput,
  ): Prisma.CharacterOrderByWithRelationInput[] {
    const field = sort?.field ?? CharacterSortField.NAME;
    const direction = sort?.direction ?? SortDirection.ASC;

    return [{ [field]: direction }, { id: 'asc' }];
  }
}
