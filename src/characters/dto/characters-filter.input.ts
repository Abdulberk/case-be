import { Field, InputType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { registerCharacterEnums } from '../models/character.enums';

registerCharacterEnums();

@InputType()
export class CharactersFilterInput {
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
  @MaxLength(120)
  search?: string;
}
