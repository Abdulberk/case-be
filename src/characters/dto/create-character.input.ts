import { Field, InputType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { registerCharacterEnums } from '../models/character.enums';

registerCharacterEnums();

@InputType()
export class CreateCharacterInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @Field()
  @IsString()
  @IsUrl()
  image!: string;

  @Field(() => CharacterStatus, { defaultValue: CharacterStatus.UNKNOWN })
  @IsOptional()
  @IsEnum(CharacterStatus)
  status?: CharacterStatus = CharacterStatus.UNKNOWN;

  @Field(() => CharacterGender, { defaultValue: CharacterGender.UNKNOWN })
  @IsOptional()
  @IsEnum(CharacterGender)
  gender?: CharacterGender = CharacterGender.UNKNOWN;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  description!: string;
}
