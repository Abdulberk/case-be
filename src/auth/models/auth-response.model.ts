import { Field, ObjectType } from '@nestjs/graphql';

import { User } from './user.model';

@ObjectType({ description: 'Authentication response with JWT token' })
export class AuthResponse {
  @Field({ description: 'JWT access token' })
  accessToken!: string;

  @Field(() => User, { description: 'Authenticated user' })
  user!: User;
}
