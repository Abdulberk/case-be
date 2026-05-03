import { Field, InputType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { registerCharacterEnums } from '../models/character.enums';

registerCharacterEnums();

@InputType()
export class UpdateCharacterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsUrl()
  image?: string;

  @Field(() => CharacterStatus, { nullable: true })
  @IsOptional()
  @IsEnum(CharacterStatus)
  status?: CharacterStatus;

  @Field(() => CharacterGender, { nullable: true })
  @IsOptional()
  @IsEnum(CharacterGender)
  gender?: CharacterGender;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description?: string;
}
