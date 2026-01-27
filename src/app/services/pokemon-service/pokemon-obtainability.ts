/**
 * Central rules for which Pokémon can appear in which "obtain" roulettes.
 *
 * Notes:
 * - "Random obtain" means roulettes like Catch, Cave, Fishing, etc.
 * - Some Pokémon are intentionally excluded because they are meant to be obtained
 *   only via special mechanics (e.g., evolution-only Hisui evolutions) or only via
 *   special roulettes (e.g., Eternal Floette as a legendary).
 */

/**
 * Hisuian regional forms that can appear in Gen 4 fossils.
 *
 * IMPORTANT (user rule):
 * - These can also appear as normal Catch Pokémon in their respective generation.
 * - Therefore, they must NOT be globally restricted from normal random obtain.
 */
export const GEN4_FOSSIL_ONLY_IDS = new Set<number>([
  // Hisuian regional forms (Gen 4 fossils)
  10229, // Growlithe (Hisui)
  10230, // Arcanine (Hisui)
  10231, // Voltorb (Hisui)
  10232, // Electrode (Hisui)
  10234, // Qwilfish (Hisui)
  10235, // Sneasel (Hisui)
  10238, // Zorua (Hisui)
  10239, // Zoroark (Hisui)
  10247 // Basculin (White-Striped)
]);

/**
 * Hisui evolutions that are NOT capturable and must only appear via evolution.
 */
export const HISUI_EVOLUTION_ONLY_IDS = new Set<number>([
  899, // Wyrdeer
  900, // Kleavor
  901, // Ursaluna
  902, // Basculegion
  903, // Sneasler
  904 // Overqwil
]);

/**
 * Pokémon that must only appear in special roulettes (e.g., Legendary roulette).
 */
export const LEGENDARY_ONLY_IDS = new Set<number>([
  10061 // Floette (Eternal)
]);

/**
 * Should NOT appear in normal random obtain roulettes (Catch, Cave, Fishing, etc.).
 */
export const RESTRICTED_FROM_RANDOM_OBTAIN = new Set<number>([
  ...Array.from(HISUI_EVOLUTION_ONLY_IDS),
  ...Array.from(LEGENDARY_ONLY_IDS)
]);

/**
 * Should NOT appear in Trade / Egg roulettes.
 *
 * For now we match the same exclusions as random obtain so these special-only
 * Pokémon don't bypass their intended mechanics.
 */
export const RESTRICTED_FROM_TRADE_AND_EGGS = new Set<number>([
  ...Array.from(HISUI_EVOLUTION_ONLY_IDS),
  ...Array.from(LEGENDARY_ONLY_IDS)
]);
