import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';

import { registerCharacterEnums } from './character.enums';

registerCharacterEnums();

@ObjectType()
export class StatusCount {
  @Field(() => CharacterStatus)
  status!: CharacterStatus;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class GenderCount {
  @Field(() => CharacterGender)
  gender!: CharacterGender;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class CharacterStats {
  @Field(() => Int)
  totalCount!: number;

  @Field(() => [StatusCount])
  byStatus!: StatusCount[];

  @Field(() => [GenderCount])
  byGender!: GenderCount[];
}
