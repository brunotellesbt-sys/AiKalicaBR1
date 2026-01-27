import { PokemonType } from "../../interfaces/pokemon-item";

/**
 * Pokemon type data mapping for all National Dex Pokemon.
 * Each entry maps pokemonId to an array of 1 or 2 types.
 * 
 * Source: Official Pokemon data
 */
export const POKEMON_TYPES: Record<number, PokemonType[]> = {
  // Generation 1 (1-151)
  1: ['grass', 'poison'],     // Bulbasaur
  2: ['grass', 'poison'],     // Ivysaur
  3: ['grass', 'poison'],     // Venusaur
  4: ['fire'],                // Charmander
  5: ['fire'],                // Charmeleon
  6: ['fire', 'flying'],      // Charizard
  7: ['water'],               // Squirtle
  8: ['water'],               // Wartortle
  9: ['water'],               // Blastoise
  10: ['bug'],                // Caterpie
  11: ['bug'],                // Metapod
  12: ['bug', 'flying'],      // Butterfree
  13: ['bug', 'poison'],      // Weedle
  14: ['bug', 'poison'],      // Kakuna
  15: ['bug', 'poison'],      // Beedrill
  16: ['normal', 'flying'],   // Pidgey
  17: ['normal', 'flying'],   // Pidgeotto
  18: ['normal', 'flying'],   // Pidgeot
  19: ['normal'],             // Rattata
  20: ['normal'],             // Raticate
  21: ['normal', 'flying'],   // Spearow
  22: ['normal', 'flying'],   // Fearow
  23: ['poison'],             // Ekans
  24: ['poison'],             // Arbok
  25: ['electric'],           // Pikachu
  26: ['electric'],           // Raichu
  27: ['ground'],             // Sandshrew
  28: ['ground'],             // Sandslash
  29: ['poison'],             // Nidoran-F
  30: ['poison'],             // Nidorina
  31: ['poison', 'ground'],   // Nidoqueen
  32: ['poison'],             // Nidoran-M
  33: ['poison'],             // Nidorino
  34: ['poison', 'ground'],   // Nidoking
  35: ['fairy'],              // Clefairy
  36: ['fairy'],              // Clefable
  37: ['fire'],               // Vulpix
  38: ['fire'],               // Ninetales
  39: ['normal', 'fairy'],    // Jigglypuff
  40: ['normal', 'fairy'],    // Wigglytuff
  41: ['poison', 'flying'],   // Zubat
  42: ['poison', 'flying'],   // Golbat
  43: ['grass', 'poison'],    // Oddish
  44: ['grass', 'poison'],    // Gloom
  45: ['grass', 'poison'],    // Vileplume
  46: ['bug', 'grass'],       // Paras
  47: ['bug', 'grass'],       // Parasect
  48: ['bug', 'poison'],      // Venonat
  49: ['bug', 'poison'],      // Venomoth
  50: ['ground'],             // Diglett
  51: ['ground'],             // Dugtrio
  52: ['normal'],             // Meowth
  53: ['normal'],             // Persian
  54: ['water'],              // Psyduck
  55: ['water'],              // Golduck
  56: ['fighting'],           // Mankey
  57: ['fighting'],           // Primeape
  58: ['fire'],               // Growlithe
  59: ['fire'],               // Arcanine
  60: ['water'],              // Poliwag
  61: ['water'],              // Poliwhirl
  62: ['water', 'fighting'],  // Poliwrath
  63: ['psychic'],            // Abra
  64: ['psychic'],            // Kadabra
  65: ['psychic'],            // Alakazam
  66: ['fighting'],           // Machop
  67: ['fighting'],           // Machoke
  68: ['fighting'],           // Machamp
  69: ['grass', 'poison'],    // Bellsprout
  70: ['grass', 'poison'],    // Weepinbell
  71: ['grass', 'poison'],    // Victreebel
  72: ['water', 'poison'],    // Tentacool
  73: ['water', 'poison'],    // Tentacruel
  74: ['rock', 'ground'],     // Geodude
  75: ['rock', 'ground'],     // Graveler
  76: ['rock', 'ground'],     // Golem
  77: ['fire'],               // Ponyta
  78: ['fire'],               // Rapidash
  79: ['water', 'psychic'],   // Slowpoke
  80: ['water', 'psychic'],   // Slowbro
  81: ['electric', 'steel'],  // Magnemite
  82: ['electric', 'steel'],  // Magneton
  83: ['normal', 'flying'],   // Farfetch'd
  84: ['normal', 'flying'],   // Doduo
  85: ['normal', 'flying'],   // Dodrio
  86: ['water'],              // Seel
  87: ['water', 'ice'],       // Dewgong
  88: ['poison'],             // Grimer
  89: ['poison'],             // Muk
  90: ['water'],              // Shellder
  91: ['water', 'ice'],       // Cloyster
  92: ['ghost', 'poison'],    // Gastly
  93: ['ghost', 'poison'],    // Haunter
  94: ['ghost', 'poison'],    // Gengar
  95: ['rock', 'ground'],     // Onix
  96: ['psychic'],            // Drowzee
  97: ['psychic'],            // Hypno
  98: ['water'],              // Krabby
  99: ['water'],              // Kingler
  100: ['electric'],          // Voltorb
  101: ['electric'],          // Electrode
  102: ['grass', 'psychic'],  // Exeggcute
  103: ['grass', 'psychic'],  // Exeggutor
  104: ['ground'],            // Cubone
  105: ['ground'],            // Marowak
  106: ['fighting'],          // Hitmonlee
  107: ['fighting'],          // Hitmonchan
  108: ['normal'],            // Lickitung
  109: ['poison'],            // Koffing
  110: ['poison'],            // Weezing
  111: ['ground', 'rock'],    // Rhyhorn
  112: ['ground', 'rock'],    // Rhydon
  113: ['normal'],            // Chansey
  114: ['grass'],             // Tangela
  115: ['normal'],            // Kangaskhan
  116: ['water'],             // Horsea
  117: ['water'],             // Seadra
  118: ['water'],             // Goldeen
  119: ['water'],             // Seaking
  120: ['water'],             // Staryu
  121: ['water', 'psychic'],  // Starmie
  122: ['psychic', 'fairy'],  // Mr. Mime
  123: ['bug', 'flying'],     // Scyther
  124: ['ice', 'psychic'],    // Jynx
  125: ['electric'],          // Electabuzz
  126: ['fire'],              // Magmar
  127: ['bug'],               // Pinsir
  128: ['normal'],            // Tauros
  129: ['water'],             // Magikarp
  130: ['water', 'flying'],   // Gyarados
  131: ['water', 'ice'],      // Lapras
  132: ['normal'],            // Ditto
  133: ['normal'],            // Eevee
  134: ['water'],             // Vaporeon
  135: ['electric'],          // Jolteon
  136: ['fire'],              // Flareon
  137: ['normal'],            // Porygon
  138: ['rock', 'water'],     // Omanyte
  139: ['rock', 'water'],     // Omastar
  140: ['rock', 'water'],     // Kabuto
  141: ['rock', 'water'],     // Kabutops
  142: ['rock', 'flying'],    // Aerodactyl
  143: ['normal'],            // Snorlax
  144: ['ice', 'flying'],     // Articuno
  145: ['electric', 'flying'], // Zapdos
  146: ['fire', 'flying'],    // Moltres
  147: ['dragon'],            // Dratini
  148: ['dragon'],            // Dragonair
  149: ['dragon', 'flying'],  // Dragonite
  150: ['psychic'],           // Mewtwo
  151: ['psychic'],           // Mew

  // Generation 2 (152-251) - Sample entries
  152: ['grass'],             // Chikorita
  153: ['grass'],             // Bayleef
  154: ['grass'],             // Meganium
  155: ['fire'],              // Cyndaquil
  156: ['fire'],              // Quilava
  157: ['fire'],              // Typhlosion
  158: ['water'],             // Totodile
  159: ['water'],             // Croconaw
  160: ['water'],             // Feraligatr
  169: ['poison', 'flying'],  // Crobat
  181: ['electric'],          // Ampharos
  186: ['water'],             // Politoed
  196: ['psychic'],           // Espeon
  197: ['dark'],              // Umbreon
  212: ['bug', 'steel'],      // Scizor
  229: ['dark', 'fire'],      // Houndoom
  230: ['water', 'dragon'],   // Kingdra
  248: ['rock', 'dark'],      // Tyranitar
  249: ['psychic', 'flying'], // Lugia
  250: ['fire', 'flying'],    // Ho-Oh

  // Generation 3-9 defaults (will use fallback 'normal' if not specified)
  
  // Mega Evolutions (10001+)
  10033: ['grass', 'poison'],     // Venusaur Mega
  10034: ['fire', 'dragon'],      // Charizard Mega X
  10035: ['fire', 'flying'],      // Charizard Mega Y
  10036: ['water'],               // Blastoise Mega
  10065: ['psychic'],             // Alakazam Mega
  10080: ['water', 'psychic'],    // Slowbro Mega
  10094: ['ghost', 'poison'],     // Gengar Mega
  10115: ['normal'],              // Kangaskhan Mega
  10127: ['bug', 'flying'],       // Pinsir Mega
  10130: ['water', 'dark'],       // Gyarados Mega
  10142: ['rock', 'flying'],      // Aerodactyl Mega
  10150: ['psychic', 'fighting'], // Mewtwo Mega X
  10151: ['psychic'],             // Mewtwo Mega Y
  10181: ['electric', 'dragon'],  // Ampharos Mega
  10212: ['bug', 'steel'],        // Scizor Mega
  10214: ['bug', 'fighting'],     // Heracross Mega
  10229: ['dark', 'fire'],        // Houndoom Mega
  10248: ['rock', 'dark'],        // Tyranitar Mega
  10306: ['fire', 'fighting'],    // Blaziken Mega
  10308: ['psychic', 'fairy'],    // Gardevoir Mega
  10313: ['steel', 'fairy'],      // Mawile Mega
  10315: ['steel'],               // Aggron Mega (loses Rock type!)
  10317: ['fighting', 'psychic'], // Medicham Mega
  10320: ['electric'],            // Manectric Mega
  10324: ['ghost'],               // Banette Mega
  10326: ['dark'],                // Absol Mega
  10337: ['dragon', 'ground'],    // Garchomp Mega
  10338: ['fighting', 'steel'],   // Lucario Mega
  10339: ['grass', 'ice'],        // Abomasnow Mega
};

/**
 * Get Pokemon types by ID. Returns a default 'normal' type if not found.
 */
export function getPokemonTypes(pokemonId: number): PokemonType[] {
  return POKEMON_TYPES[pokemonId] || ['normal'];
}
