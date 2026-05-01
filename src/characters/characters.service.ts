import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CharactersFilterInput } from './dto/characters-filter.input';
import { PaginationInput } from './dto/pagination.input';
import { CharacterConnection } from './models/character-connection.model';

@Injectable()
export class CharactersService {
  private static readonly DEFAULT_TAKE = 20;
  private static readonly MAX_TAKE = 50;

  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    filter?: CharactersFilterInput,
    pagination?: PaginationInput,
  ): Promise<CharacterConnection> {
    const where = this.buildWhere(filter);
    const skip = Math.max(pagination?.skip ?? 0, 0);
    const take = Math.min(
      Math.max(pagination?.take ?? CharactersService.DEFAULT_TAKE, 1),
      CharactersService.MAX_TAKE,
    );

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
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

  private buildWhere(filter?: CharactersFilterInput): Prisma.CharacterWhereInput {
    const search = filter?.search?.trim();

    return {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.gender ? { gender: filter.gender } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}
