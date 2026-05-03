import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CharactersModule } from './characters/characters.module';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { complexityPlugin } from './plugins/complexity.plugin';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: () => {
        let savedSchema: import('graphql').GraphQLSchema;
        return {
          autoSchemaFile: true,
          path: '/graphql',
          sortSchema: true,
          playground: process.env.NODE_ENV !== 'production',
          introspection: process.env.NODE_ENV !== 'production',
          includeStacktraceInErrorResponses:
            process.env.NODE_ENV !== 'production',
          transformSchema: (schema: import('graphql').GraphQLSchema) => {
            savedSchema = schema;
            return schema;
          },
          plugins: [complexityPlugin(() => savedSchema)],
        };
      },
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    CharactersModule,
  ],
})
export class AppModule {}
