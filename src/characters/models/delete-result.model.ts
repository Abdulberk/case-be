import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteResult {
  @Field(() => ID)
  id!: string;

  @Field()
  success!: boolean;
}
