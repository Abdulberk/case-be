import { ValidationPipe } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';
import request from 'supertest';

import { CharactersModule } from '../src/characters/characters.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CharactersResolver', () => {
  it('serves the characters GraphQL query with filters and pagination', async () => {
    const character = {
      id: 'char_test',
      image: 'https://i.pravatar.cc/512?u=test',
      name: 'Test Character',
      status: CharacterStatus.ALIVE,
      gender: CharacterGender.FEMALE,
      description: 'A searchable pilot.',
    };
    const prisma = {
      character: {
        findMany: jest.fn(() => ({ query: 'findMany' })),
        count: jest.fn(() => ({ query: 'count' })),
      },
      $transaction: jest.fn(async () => [[character], 1]),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          path: '/graphql',
          sortSchema: true,
        }),
        CharactersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    const app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    try {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query Characters($filter: CharactersFilterInput, $pagination: PaginationInput) {
              characters(filter: $filter, pagination: $pagination) {
                items {
                  id
                  image
                  name
                  status
                  gender
                  description
                }
                totalCount
                pageInfo {
                  skip
                  take
                  hasNextPage
                }
              }
            }
          `,
          variables: {
            filter: {
              status: 'ALIVE',
              gender: 'FEMALE',
              search: 'pilot',
            },
            pagination: {
              skip: 0,
              take: 10,
            },
          },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.characters).toEqual({
        items: [character],
        totalCount: 1,
        pageInfo: {
          skip: 0,
          take: 10,
          hasNextPage: false,
        },
      });
      expect(prisma.character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: CharacterStatus.ALIVE,
            gender: CharacterGender.FEMALE,
            OR: [
              { name: { contains: 'pilot', mode: 'insensitive' } },
              { description: { contains: 'pilot', mode: 'insensitive' } },
            ],
          },
          skip: 0,
          take: 10,
        }),
      );
    } finally {
      await app.close();
    }
  });
});
