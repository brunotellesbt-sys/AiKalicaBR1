import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { GameState, Gender, HouseState, Character } from '../models';
import { REGIONS, LOCATIONS, TRAVEL_GRAPH } from '../data/regions';
import { HOUSES } from '../data/houses';
import { buildInitialState, applyChoice, applyTravel, applyDiplomacy, applyDiplomacyChoice, applyDaenerysAction, applyTraining, applyHouseMgmt, applyIronBank, applyLocalAction, applyTournamentAction, applyMissionAction, promptMainMenu } from './sim';
import { Rng } from './rng';
import { uid } from './utils';

function toMap<T extends {id: string}>(arr: T[]): Record<string, T> {
  return arr.reduce((acc, x) => { acc[x.id] = x; return acc; }, {} as Record<string, T>);
}



function stripRomanSuffix(name: string): string {
  return name.replace(/\s+[IVXLCDM]+$/i, '').trim();
}

function toRoman(n: number): string {
  const map: Array<[number, string]> = [
    [1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],
    [100,'C'],[90,'XC'],[50,'L'],[40,'XL'],
    [10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I'],
  ];
  let res = '';
  let x = n;
  for (const [v, sym] of map) {
    while (x >= v) { res += sym; x -= v; }
  }
  return res || 'I';
}

function ensureUniqueRegnalName(state: GameState, childId: string, desiredFirstName: string): string {
  const child = state.characters[childId];
  if (!child) return desiredFirstName;
  const base = stripRomanSuffix(desiredFirstName);
  // regra: evita repetição dentro da mesma família (mesmo sobrenome/casa de nascimento)
  const same = Object.values(state.characters).filter(c =>
    c.id !== childId &&
    c.birthHouseId === child.birthHouseId &&
    stripRomanSuffix(c.name || '') === base
  );
  const count = same.length;
  if (count <= 0) return base;
  return `${base} ${toRoman(count + 1)}`;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private rng = new Rng(Date.now() >>> 0);
  private state$ = new BehaviorSubject<GameState | null>(null);

  readonly vm$ = this.state$.asObservable();

  constructor() {}

  newGame(playerHouseId: string, gender: Gender): void {
    const housesBase = this.buildBaseHouses();
    const charactersBase: Record<string, Character> = {};

    const state = buildInitialState(this.rng.getSeed(), { playerHouseId, gender }, {
      locations: toMap(LOCATIONS),
      regions: toMap(REGIONS),
      travelGraph: TRAVEL_GRAPH,
      houses: housesBase,
      characters: charactersBase,
    });

    this.state$.next(state);
  }

  setState(state: GameState): void {
    // migração leve (caso carregue saves antigos)
    (state as any).game = (state as any).game ?? { over: false, victory: false, reason: '' };
    (state as any).endgame = (state as any).endgame ?? { wallBreached: false, danyArrived: false, danyRelation: 0, kingsLandingBurned: false };
    (state as any).canon = (state as any).canon ?? { enabled: true, mode: 'strict', appliedEventIds: {} };
    (state as any).tournaments = (state as any).tournaments ?? [];
    (state as any).missions = (state as any).missions ?? [];
    state.ui = (state as any).ui ?? { activeTab: 'chat', showSetup: false, pendingNameQueue: [] };
    (state.ui as any).pendingNameQueue = (state.ui as any).pendingNameQueue ?? [];
    for (const c of Object.values(state.characters)) {
      (c as any).personalPrestige = (c as any).personalPrestige ?? 0;
      (c as any).personalGold = (c as any).personalGold ?? 0;
      (c as any).kissedIds = (c as any).kissedIds ?? [];
      (c as any).isBastard = (c as any).isBastard ?? false;
      (c as any).pregnancy = (c as any).pregnancy ?? undefined;
    }
    for (const h of Object.values(state.houses)) {
      (h as any).army.dragons = (h as any).army.dragons ?? 0;
      (h as any).resources.goods = (h as any).resources.goods ?? 0;
      (h as any).economy.taxRate = (h as any).economy.taxRate ?? ((h as any).suzerainId ? 0.15 : 0.0);
    }

    (state.canon as any).enabled = (state.canon as any).enabled ?? true;
    (state.canon as any).mode = (state.canon as any).mode ?? 'strict';
    (state.canon as any).appliedEventIds = (state.canon as any).appliedEventIds ?? {};
    (state.canon as any).resolvedAbsTurns = (state.canon as any).resolvedAbsTurns ?? {};
    (state.canon as any).activeWarIds = (state.canon as any).activeWarIds ?? [];
    (state.canon as any).warStates = (state.canon as any).warStates ?? {};

    // Divergência canônica por interferência do jogador
    (state.canon as any).playerTouchedCanonIds = (state.canon as any).playerTouchedCanonIds ?? {};
    (state.canon as any).playerTouchedReasons = (state.canon as any).playerTouchedReasons ?? {};
    (state.canon as any).bypassedDeathCanonIds = (state.canon as any).bypassedDeathCanonIds ?? {};
    (state.canon as any).pendingBirths = (state.canon as any).pendingBirths ?? {};

    // reseta rng a partir do "tempo" (mantém pseudo-determinismo)
    this.rng.setSeed(state.date.absoluteTurn * 2654435761 >>> 0);
    this.state$.next(state);
  }

  getState(): GameState {
    const s = this.state$.value;
    if (!s) throw new Error('Estado não inicializado.');
    return s;
  }

  choose(choiceId: string): void {
    const s = this.getState();

    if (choiceId === 'reset') {
      this.state$.next(null);
      return;
    }

    if (s.game?.over && !['saves'].includes(choiceId)) {
      // Em game over, só permitimos abrir a aba de saves (e reset via botão).
      return;
    }
    // comandos especiais embutidos em choiceId
    if (choiceId === 'back') {
      // volta ao menu principal via sim.ts (recriando prompt)
      // truque: chama applyChoice com end_turn? não. Melhor: adiciona mensagem e recria menu.
      // Aqui só reemitimos o menu principal com uma pequena escolha.
      // Para evitar circular import, usamos applyChoice em "no-op": reabrir menu pelo workflow normal
      // -> adicionamos um "sistema" e acionamos a próxima mensagem escolhendo "chronicle"? Não.
      // Simples: cria um prompt atual com as mesmas opções novamente chamando applyChoice em 'chronicle' não.
      // Então: vamos chamar um “choice” interno: 'chronicle' não. Melhor: usamos applyChoice? não tem.
      // Solução: chamamos applyChoice com um id inválido não faz nada. Então, aqui a gente reseta o last choices e injeta um novo menu.
      promptMainMenu(s, this.rng);
      return this.state$.next({ ...s });
    }

    
    // canon controls
    if (choiceId.startsWith('canon:')) {
      const parts = choiceId.split(':');
      const cmd = parts[1];
      const arg = parts[2];

      (s as any).canon = (s as any).canon ?? { enabled: true, mode: 'strict', appliedEventIds: {}, resolvedAbsTurns: {}, activeWarIds: [] };

      if (cmd === 'toggle') {
        (s.canon as any).enabled = !((s.canon as any).enabled ?? true);
      }
      if (cmd === 'mode' && (arg === 'strict' || arg === 'anchors')) {
        (s.canon as any).mode = arg;
      }

      // Recria menu para refletir no chat (sem avançar o turno)
      promptMainMenu(s, this.rng);
      return this.state$.next({ ...s });
    }

// travel: go:location
    if (choiceId.startsWith('go:')) {
      const to = choiceId.split(':')[1];
      applyTravel(s, this.rng, to);
      return this.state$.next({ ...s });
    }

    // diplomacy
    if (choiceId.startsWith('dip:')) {
      const action = choiceId.split(':')[1];
      applyDiplomacy(s, this.rng, action);
      return this.state$.next({ ...s });
    }

    if (choiceId.startsWith('dany:')) {
      applyDaenerysAction(s, this.rng, choiceId.split(':')[1]);
      return this.state$.next({ ...s });
    }
    if (choiceId.startsWith('talk:')) {
      applyDiplomacyChoice(s, this.rng, 'talk', choiceId.split(':')[1]);
      return this.state$.next({ ...s });
    }
    if (choiceId.startsWith('gift:')) {
      applyDiplomacyChoice(s, this.rng, 'gift', choiceId.split(':')[1]);
      return this.state$.next({ ...s });
    }
    if (choiceId.startsWith('aud:')) {
      applyDiplomacyChoice(s, this.rng, 'aud', choiceId.split(':')[1]);
      return this.state$.next({ ...s });
    }
    if (choiceId.startsWith('mar:')) {
      applyDiplomacyChoice(s, this.rng, 'mar', choiceId.split(':')[1]);
      return this.state$.next({ ...s });
    }
    if (choiceId.startsWith('ib:loan:')) {
      const amt = choiceId.split(':')[2];
      applyIronBank(s, this.rng, `loan:${amt}`);
      return this.state$.next({ ...s });
    }
    if (choiceId === 'ib:paymin') {
      applyIronBank(s, this.rng, 'paymin');
      return this.state$.next({ ...s });
    }
    if (choiceId === 'ib:payall') {
      applyIronBank(s, this.rng, 'payall');
      return this.state$.next({ ...s });
    }

    // training
    if (choiceId.startsWith('tr:')) {
      applyTraining(s, this.rng, choiceId.split(':')[1]);
      return this.state$.next({ ...s });
    }

    // house mgmt
    if (choiceId.startsWith('hm:')) {
      applyHouseMgmt(s, this.rng, choiceId.substring('hm:'.length));
      return this.state$.next({ ...s });
    }


// missions
if (choiceId.startsWith('ms:')) {
  const cmd = choiceId.substring('ms:'.length);
  applyMissionAction(s, this.rng, cmd);
  return this.state$.next({ ...s });
}

    // local interactions (personagens no local)
    if (choiceId.startsWith('loc:')) {
      const parts = choiceId.split(':');
      const action = parts[1];
      const targetId = parts[2];
      const extra = parts[3];
      applyLocalAction(s, this.rng, action as any, targetId, extra);
      return this.state$.next({ ...s });
    }

    // tournaments
    if (choiceId.startsWith('tour:')) {
      const cmd = choiceId.substring('tour:'.length);
      applyTournamentAction(s, this.rng, cmd);
      return this.state$.next({ ...s });
    }

    // generic
    applyChoice(s, this.rng, choiceId);
    this.state$.next({ ...s });
  }


  nameChild(childId: string, firstName: string): void {
  const s = this.getState();
  const q = (s.ui as any).pendingNameQueue as string[] | undefined;
  const child = s.characters[childId];
  if (!child) return;
  const clean = (firstName || '').trim();
  if (!clean) return;

  child.name = ensureUniqueRegnalName(s, childId, clean);
  // remove from queue
  if (q) {
    const idx = q.indexOf(childId);
    if (idx >= 0) q.splice(idx, 1);
  }

  s.chat.push({
    id: uid('m'),
    speaker: 'narrador' as any,
    text: `👶 O bebê recebe o nome de ${clean}.`,
    tsTurn: s.date.absoluteTurn,
  });
  s.chronicle.unshift({
    turn: s.date.absoluteTurn,
    title: 'Nomeado',
    body: `${clean} recebe seu nome.`,
    tags: ['nascimento'],
  });

  this.state$.next({ ...s });
}

  nextPendingBabyId(): string | null {
  const s = this.getState();
  const q = (s.ui as any).pendingNameQueue as string[] | undefined;
  return q && q.length ? q[0] : null;
}

  private buildBaseHouses(): Record<string, HouseState> {

    const map: Record<string, HouseState> = {};
    for (const h of HOUSES) {
      map[h.id] = {
        ...h,
        prestige: h.prestigeBase,
        relations: {},
        leaderId: '',
        economy: {
          peasants: 0,
          soldiers: 0,
          farms: 0,
          trainingGrounds: 0,
          walls: 0,
          tradeLastDelegationTurn: 0,
          tradePartners: [],
          taxRate: h.suzerainId ? 0.15 : 0.0,
        },
        resources: { gold: 0, food: 0, goods: 0 },
        army: { levies: 0, menAtArms: 0, squires: 0, knights: 0, dragons: 0, stationedRatio: 0.7 },
      };
    }
    return map;
  }
}
