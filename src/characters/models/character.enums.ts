import { registerEnumType } from '@nestjs/graphql';
import { CharacterGender, CharacterStatus } from '@prisma/client';

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

  registered = true;
}
