import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Public, Roles } from '../auth/decorators';
import { CharactersService } from './characters.service';
import { CharacterSortInput } from './dto/character-sort.input';
import { CharactersFilterInput } from './dto/characters-filter.input';
import { CreateCharacterInput } from './dto/create-character.input';
import { PaginationInput } from './dto/pagination.input';
import { UpdateCharacterInput } from './dto/update-character.input';
import { CharacterConnection } from './models/character-connection.model';
import { CharacterStats } from './models/character-stats.model';
import { Character } from './models/character.model';
import { DeleteResult } from './models/delete-result.model';

@Resolver(() => Character)
export class CharactersResolver {
  constructor(private readonly charactersService: CharactersService) {}

  // ─── Queries (Public — no auth required) ───────────────────

  @Public()
  @Query(() => Character, { description: 'Get a single character by ID' })
  character(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Character> {
    return this.charactersService.findOne(id);
  }

  @Public()
  @Query(() => CharacterConnection, {
    description: 'List characters with optional filter, pagination & sorting',
  })
  characters(
    @Args('filter', { nullable: true, type: () => CharactersFilterInput })
    filter?: CharactersFilterInput,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination?: PaginationInput,
    @Args('sort', { nullable: true, type: () => CharacterSortInput })
    sort?: CharacterSortInput,
  ): Promise<CharacterConnection> {
    return this.charactersService.findMany(filter, pagination, sort);
  }

  @Public()
  @Query(() => CharacterStats, {
    description: 'Get aggregate statistics about characters',
  })
  characterStats(): Promise<CharacterStats> {
    return this.charactersService.getStats();
  }

  // ─── Admin Mutations (ADMIN role required) ─────────────────

  @Roles('ADMIN')
  @Mutation(() => Character, { description: 'Create a new character (admin)' })
  createCharacter(
    @Args('input') input: CreateCharacterInput,
  ): Promise<Character> {
    return this.charactersService.create(input);
  }

  @Roles('ADMIN')
  @Mutation(() => Character, {
    description: 'Update an existing character (admin)',
  })
  updateCharacter(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCharacterInput,
  ): Promise<Character> {
    return this.charactersService.update(id, input);
  }

  @Roles('ADMIN')
  @Mutation(() => DeleteResult, {
    description: 'Delete a character by ID (admin)',
  })
  deleteCharacter(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DeleteResult> {
    return this.charactersService.delete(id);
  }
}
