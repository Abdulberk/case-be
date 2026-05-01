import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';

import { registerCharacterEnums } from './character.enums';

registerCharacterEnums();

@ObjectType()
export class Character {
  @Field(() => ID)
  id!: string;

  @Field()
  image!: string;

  @Field()
  name!: string;

  @Field(() => CharacterStatus)
  status!: CharacterStatus;

  @Field(() => CharacterGender)
  gender!: CharacterGender;

  @Field()
  description!: string;
}
