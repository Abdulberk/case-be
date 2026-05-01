import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PageInfo {
  @Field(() => Int)
  skip!: number;

  @Field(() => Int)
  take!: number;

  @Field()
  hasNextPage!: boolean;
}
