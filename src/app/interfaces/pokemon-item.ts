import { WheelItem } from "./wheel-item";

export type PokemonType = 
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' 
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface PokemonItem extends WheelItem {
  pokemonId: number;
  /**
   * Optional National Dex / base species id for forms.
   *
   * Example: Hisuian Growlithe (pokemonId 10229) has basePokemonId 58.
   *
   * This is useful when we need to query species data (mega evolutions, etc.).
   */
  basePokemonId?: number;
  sprite: {
    front_default: string;
    front_shiny: string;
  } | null;
  shiny: boolean;
  power: 1 | 2 | 3 | 4 | 5 | 6;
  
  /** Pokemon types (1 or 2 types) */
  types?: PokemonType[];

  /** Battle-only flags (e.g., Mega Evolution). */
  isMegaEvolved?: boolean;
  megaBackup?: {
    text: string;
    sprite: {
      front_default: string;
      front_shiny: string;
    } | null;
    power: 1 | 2 | 3 | 4 | 5 | 6;
  };
}