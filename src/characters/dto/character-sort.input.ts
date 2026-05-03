import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';

import { CharacterSortField, SortDirection } from '../models/character.enums';

@InputType()
export class CharacterSortInput {
  @Field(() => CharacterSortField, { defaultValue: CharacterSortField.NAME })
  @IsOptional()
  @IsEnum(CharacterSortField)
  field?: CharacterSortField = CharacterSortField.NAME;

  @Field(() => SortDirection, { defaultValue: SortDirection.ASC })
  @IsOptional()
  @IsEnum(SortDirection)
  direction?: SortDirection = SortDirection.ASC;
}
