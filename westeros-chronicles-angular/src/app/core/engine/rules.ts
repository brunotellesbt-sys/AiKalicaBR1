/**
 * Regras e tabelas puras do jogo.
 *
 * Sem efeito colateral e sem dependência de outros domínios: escalas de renome,
 * títulos, mortalidade por idade, tiers econômicos e peso militar.
 */
import { Army, Gender, HouseState, RenownTier, TournamentSize } from '../models';
import { clamp } from './utils';

const RENOWN_ORDER: RenownTier[] = ['comum', 'forte', 'reconhecido', 'imponente', 'renomado'];

export function renownFromMartial(martial: number): RenownTier {
  if (martial >= 92) return 'renomado';
  if (martial >= 78) return 'imponente';
  if (martial >= 62) return 'reconhecido';
  if (martial >= 45) return 'forte';
  return 'comum';
}

export function titleForHouse(houseId: string, gender: Gender): string {
  // títulos simples e coerentes com a fantasia (sem tentar “cobrir tudo”)
  const base = gender === 'M' ? 'Lorde' : 'Lady';
  switch (houseId) {
    case 'stark': return gender === 'M' ? 'Protetor do Norte' : 'Protetora do Norte';
    case 'arryn': return gender === 'M' ? 'Protetor do Vale' : 'Protetora do Vale';
    case 'tully': return gender === 'M' ? 'Senhor de Correrrio' : 'Senhora de Correrrio';
    case 'greyjoy': return gender === 'M' ? 'Lorde das Ilhas de Ferro' : 'Lady das Ilhas de Ferro';
    case 'lannister': return gender === 'M' ? 'Senhor de Rochedo Casterly' : 'Senhora de Rochedo Casterly';
    case 'baratheon': return gender === 'M' ? 'Senhor de Ponta Tempestade' : 'Senhora de Ponta Tempestade';
    case 'tyrell': return gender === 'M' ? 'Senhor de Jardim de Cima' : 'Senhora de Jardim de Cima';
    case 'martell': return gender === 'M' ? 'Príncipe de Dorne' : 'Princesa de Dorne';
    case 'targaryen_throne': return gender === 'M' ? 'Rei dos Nove Reinos' : 'Rainha dos Nove Reinos';
    default: return `${base} de ${houseId}`;
  }
}

export function deathChanceByAge(age: number): number {
  // regra pedida: 55:5%, 60:10%, 65:15%, 70:20%...
  if (age < 55) return 0;
  const step = Math.floor((age - 55) / 5) + 1; // 55..59 =>1, 60..64=>2...
  return clamp(step * 0.05, 0.05, 0.95);
}

// --- Economia por "tiers" ---
// Pedido do jogo: IA econômica deve respeitar melhor reservas 200/350/500/700.
export function econTierGold(house: { prestigeBase: number; isIronThrone?: boolean }): 200 | 350 | 500 | 700 {
  if (house.isIronThrone) return 700;
  const p = house.prestigeBase;
  if (p >= 80) return 700;
  if (p >= 60) return 500;
  if (p >= 45) return 350;
  return 200;
}

export function armyPower(a: Army): number {
  // escala simples: levies 1, men-at-arms 2, squires 3, knights 5, dragons 10000 por unidade.
  return (
    (a.levies ?? 0) * 1 +
    (a.menAtArms ?? 0) * 2 +
    (a.squires ?? 0) * 3 +
    (a.knights ?? 0) * 5 +
    (a.dragons ?? 0) * 10000
  );
}

export function computeArmyPower(army: Army): number {
  // Unidades em massa só vão até cavaleiros.
  // Dragões (quando presentes) contam como equivalentes a 10.000 cavaleiros por dragão.
  const knightsEq = army.knights + (army.dragons * 10000);
  return (
    (army.levies * 1) +
    (army.menAtArms * 2) +
    (army.squires * 3) +
    (knightsEq * 4)
  );
}

export function armyMassCount(h: HouseState): number {
  const a = h.army;
  return (a.levies + a.menAtArms + a.squires + a.knights);
}

export function foodNeedMin(h: HouseState): number {
  // Regra do usuário: exército de massa + 100
  return armyMassCount(h) + 100;
}

export function prestigeToTournamentSize(prestige: number): TournamentSize {
  if (prestige < 45) return 'menor';
  if (prestige < 75) return 'medio';
  return 'importante';
}

export function categoriesForSize(size: TournamentSize): RenownTier[] {
  // 3 tipos conforme pedido: menor (fraco->intermediário), médio (2º fraco->2º forte), importante (intermediário->mais forte)
  if (size === 'menor') return ['comum', 'forte', 'reconhecido'];
  if (size === 'medio') return ['forte', 'reconhecido', 'imponente'];
  return ['reconhecido', 'imponente', 'renomado'];
}

export function applyArmyLoss(a: Army, frac: number): void {
  const f = clamp(frac, 0, 0.95);
  a.levies = Math.max(0, Math.floor((a.levies ?? 0) * (1 - f)));
  a.menAtArms = Math.max(0, Math.floor((a.menAtArms ?? 0) * (1 - f)));
  a.squires = Math.max(0, Math.floor((a.squires ?? 0) * (1 - f)));
  a.knights = Math.max(0, Math.floor((a.knights ?? 0) * (1 - f)));
  // dragões não são reduzidos aqui (seria uma mecânica específica)
}
