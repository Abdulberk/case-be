import { CharacterGender, CharacterStatus } from '@prisma/client';

import { characterSeedData } from '../prisma/seed-data';

describe('character seed data', () => {
  it('has enough deterministic data for filtering and search testing', () => {
    expect(characterSeedData).toHaveLength(24);

    const ids = new Set(characterSeedData.map((character) => character.id));
    expect(ids.size).toBe(characterSeedData.length);

    expect(new Set(characterSeedData.map((character) => character.status))).toEqual(
      new Set([CharacterStatus.ALIVE, CharacterStatus.DEAD, CharacterStatus.UNKNOWN]),
    );
    expect(new Set(characterSeedData.map((character) => character.gender))).toEqual(
      new Set([CharacterGender.MALE, CharacterGender.FEMALE, CharacterGender.UNKNOWN]),
    );

    const searchableText = characterSeedData
      .map((character) => `${character.name} ${character.description}`)
      .join(' ')
      .toLowerCase();

    expect(searchableText).toContain('pilot');
    expect(searchableText).toContain('engineer');
    expect(searchableText).toContain('detective');
    expect(searchableText).toContain('medic');
  });
});
