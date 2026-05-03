import { ValidationPipe } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';
import request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { CharactersModule } from '../src/characters/characters.module';
import { PrismaService } from '../src/prisma/prisma.service';

const JWT_SECRET = 'test-jwt-secret-key-minimum-16-chars';

const adminUser = {
  id: 'user_admin',
  email: 'admin@test.com',
  password: '$2a$12$hashedpassword',
  name: 'Admin',
  role: 'ADMIN',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const regularUser = {
  id: 'user_regular',
  email: 'user@test.com',
  password: '$2a$12$hashedpassword',
  name: 'Regular User',
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CharactersResolver', () => {
  const character = {
    id: 'char_test',
    image: 'https://i.pravatar.cc/512?u=test',
    name: 'Test Character',
    status: CharacterStatus.ALIVE,
    gender: CharacterGender.FEMALE,
    description: 'A searchable pilot.',
  };

  let adminToken: string;
  let userToken: string;

  const createApp = async (prismaOverride: Record<string, unknown>) => {
    // Merge user mock for JWT strategy validation
    const prismaMock = {
      ...prismaOverride,
      user: {
        findUnique: jest.fn(
          async ({ where }: { where: { id?: string; email?: string } }) => {
            if (where.id === adminUser.id || where.email === adminUser.email)
              return adminUser;
            if (
              where.id === regularUser.id ||
              where.email === regularUser.email
            )
              return regularUser;
            return null;
          },
        ),
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              ADMIN_API_KEY: 'test-admin-key',
              JWT_SECRET,
              JWT_EXPIRES_IN: '1h',
            }),
          ],
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          path: '/graphql',
          sortSchema: true,
        }),
        AuthModule,
        CharactersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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

    // Generate JWT tokens once
    if (!adminToken) {
      const jwtService = moduleRef.get(JwtService);
      adminToken = jwtService.sign({
        sub: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
      userToken = jwtService.sign({
        sub: regularUser.id,
        email: regularUser.email,
        role: regularUser.role,
      });
    }

    return app;
  };

  // ─── Public Query Tests (no auth required) ─────────────────

  it('serves the characters GraphQL query with filters, pagination, and sorting', async () => {
    const prisma = {
      character: {
        findMany: jest.fn(() => ({ query: 'findMany' })),
        count: jest.fn(() => ({ query: 'count' })),
      },
      $transaction: jest.fn(async () => [[character], 1]),
    };
    const app = await createApp(prisma);

    try {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query Characters($filter: CharactersFilterInput, $pagination: PaginationInput, $sort: CharacterSortInput) {
              characters(filter: $filter, pagination: $pagination, sort: $sort) {
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
            sort: {
              field: 'NAME',
              direction: 'DESC',
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
          orderBy: [{ name: 'desc' }, { id: 'asc' }],
          skip: 0,
          take: 10,
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('serves the character query by id', async () => {
    const prisma = {
      character: {
        findUnique: jest.fn(async () => character),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const app = await createApp(prisma);

    try {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query Character($id: ID!) {
              character(id: $id) {
                id
                name
                status
                gender
                description
              }
            }
          `,
          variables: { id: 'char_test' },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.character).toEqual({
        id: character.id,
        name: character.name,
        status: character.status,
        gender: character.gender,
        description: character.description,
      });
    } finally {
      await app.close();
    }
  });

  it('serves the characterStats query', async () => {
    const prisma = {
      character: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn(async () => [
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
      ]),
    };
    const app = await createApp(prisma);

    try {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              characterStats {
                totalCount
                byStatus {
                  status
                  count
                }
                byGender {
                  gender
                  count
                }
              }
            }
          `,
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.characterStats).toEqual({
        totalCount: 24,
        byStatus: [
          { status: 'ALIVE', count: 10 },
          { status: 'DEAD', count: 8 },
          { status: 'UNKNOWN', count: 6 },
        ],
        byGender: [
          { gender: 'FEMALE', count: 9 },
          { gender: 'MALE', count: 9 },
          { gender: 'UNKNOWN', count: 6 },
        ],
      });
    } finally {
      await app.close();
    }
  });

  it('returns an error for a non-existent character', async () => {
    const prisma = {
      character: {
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const app = await createApp(prisma);

    try {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query Character($id: ID!) {
              character(id: $id) {
                id
                name
              }
            }
          `,
          variables: { id: 'nonexistent' },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('not found');
    } finally {
      await app.close();
    }
  });

  // ─── Admin Mutation Tests (JWT + ADMIN role required) ──────

  describe('createCharacter mutation', () => {
    const createMutation = `
      mutation CreateCharacter($input: CreateCharacterInput!) {
        createCharacter(input: $input) {
          id
          name
          image
          status
          gender
          description
        }
      }
    `;

    it('creates a character with admin JWT token', async () => {
      const created = {
        id: 'char_new',
        name: 'New Hero',
        image: 'https://example.com/hero.png',
        status: CharacterStatus.ALIVE,
        gender: CharacterGender.MALE,
        description: 'A brand new hero for testing purposes.',
      };
      const prisma = {
        character: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(async () => created),
        },
        $transaction: jest.fn(),
      };
      const app = await createApp(prisma);

      try {
        const response = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            query: createMutation,
            variables: {
              input: {
                name: 'New Hero',
                image: 'https://example.com/hero.png',
                status: 'ALIVE',
                gender: 'MALE',
                description: 'A brand new hero for testing purposes.',
              },
            },
          })
          .expect(200);

        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.createCharacter).toEqual(created);
      } finally {
        await app.close();
      }
    });

    it('rejects without authentication', async () => {
      const prisma = {
        character: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      };
      const app = await createApp(prisma);

      try {
        const response = await request(app.getHttpServer())
          .post('/graphql')
          .send({
            query: createMutation,
            variables: {
              input: {
                name: 'Hacker',
                image: 'https://example.com/hack.png',
                description: 'Should not be created without auth.',
              },
            },
          })
          .expect(200);

        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('Unauthorized');
        expect(prisma.character.create).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it('rejects with non-admin (USER) role', async () => {
      const prisma = {
        character: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      };
      const app = await createApp(prisma);

      try {
        const response = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            query: createMutation,
            variables: {
              input: {
                name: 'Hacker',
                image: 'https://example.com/hack.png',
                description: 'Should not be created with USER role.',
              },
            },
          })
          .expect(200);

        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain(
          'do not have permission',
        );
        expect(prisma.character.create).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });
  });

  describe('updateCharacter mutation', () => {
    it('updates a character with admin JWT token', async () => {
      const updated = { ...character, name: 'Updated Name' };
      const prisma = {
        character: {
          findUnique: jest.fn(async () => character),
          findMany: jest.fn(),
          count: jest.fn(),
          update: jest.fn(async () => updated),
        },
        $transaction: jest.fn(),
      };
      const app = await createApp(prisma);

      try {
        const response = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            query: `
              mutation UpdateCharacter($id: ID!, $input: UpdateCharacterInput!) {
                updateCharacter(id: $id, input: $input) {
                  id
                  name
                }
              }
            `,
            variables: {
              id: 'char_test',
              input: { name: 'Updated Name' },
            },
          })
          .expect(200);

        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.updateCharacter).toEqual({
          id: 'char_test',
          name: 'Updated Name',
        });
      } finally {
        await app.close();
      }
    });
  });

  describe('deleteCharacter mutation', () => {
    it('deletes a character with admin JWT token', async () => {
      const prisma = {
        character: {
          findUnique: jest.fn(async () => character),
          findMany: jest.fn(),
          count: jest.fn(),
          delete: jest.fn(async () => character),
        },
        $transaction: jest.fn(),
      };
      const app = await createApp(prisma);

      try {
        const response = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            query: `
              mutation DeleteCharacter($id: ID!) {
                deleteCharacter(id: $id) {
                  id
                  success
                }
              }
            `,
            variables: { id: 'char_test' },
          })
          .expect(200);

        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.deleteCharacter).toEqual({
          id: 'char_test',
          success: true,
        });
      } finally {
        await app.close();
      }
    });
  });
});
