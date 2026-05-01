import { Args, Query, Resolver } from '@nestjs/graphql';

import { CharactersService } from './characters.service';
import { CharactersFilterInput } from './dto/characters-filter.input';
import { PaginationInput } from './dto/pagination.input';
import { CharacterConnection } from './models/character-connection.model';
import { Character } from './models/character.model';

@Resolver(() => Character)
export class CharactersResolver {
  constructor(private readonly charactersService: CharactersService) {}

  @Query(() => CharacterConnection)
  characters(
    @Args('filter', { nullable: true, type: () => CharactersFilterInput })
    filter?: CharactersFilterInput,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination?: PaginationInput,
  ): Promise<CharacterConnection> {
    return this.charactersService.findMany(filter, pagination);
  }
}
