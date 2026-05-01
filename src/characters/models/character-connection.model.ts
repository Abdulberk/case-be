import { Field, Int, ObjectType } from '@nestjs/graphql';

import { Character } from './character.model';
import { PageInfo } from './page-info.model';

@ObjectType()
export class CharacterConnection {
  @Field(() => [Character])
  items!: Character[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => PageInfo)
  pageInfo!: PageInfo;
}
