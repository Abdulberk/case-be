import { registerEnumType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';

export enum CharacterSortField {
  NAME = 'name',
  STATUS = 'status',
  GENDER = 'gender',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

let registered = false;

export function registerCharacterEnums(): void {
  if (registered) {
    return;
  }

  registerEnumType(CharacterStatus, {
    name: 'CharacterStatus',
  });

  registerEnumType(CharacterGender, {
    name: 'CharacterGender',
  });

  registerEnumType(CharacterSortField, {
    name: 'CharacterSortField',
  });

  registerEnumType(SortDirection, {
    name: 'SortDirection',
  });

  registered = true;
}
