import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

@InputType({ description: 'Input for user registration' })
export class RegisterInput {
  @Field({ description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @Field({ description: 'User password (min 6 characters)' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @Field({ description: 'User display name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;
}
