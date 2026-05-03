import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User role for authorization',
});

@ObjectType({ description: 'User account' })
export class User {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'User email address' })
  email!: string;

  @Field({ description: 'User display name' })
  name!: string;

  @Field(() => UserRole, { description: 'User role' })
  role!: UserRole;

  @Field({ description: 'Account creation date' })
  createdAt!: Date;

  @Field({ description: 'Last update date' })
  updatedAt!: Date;
}
