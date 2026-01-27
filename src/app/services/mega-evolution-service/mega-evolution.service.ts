import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, throwError } from 'rxjs';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonService } from '../pokemon-service/pokemon.service';
import { TrainerService } from '../trainer-service/trainer.service';

export interface MegaForm {
  /** PokeAPI Pokémon id of the Mega form. */
  pokemonId: number;
  /** PokeAPI name (e.g. "charizard-mega-x"). */
  apiName: string;
  /** Display name (e.g. "Mega Charizard X"). */
  displayName: string;
}

interface PokemonSpeciesResponse {
  varieties: Array<{
    is_default: boolean;
    pokemon: {
      name: string;
      url: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class MegaEvolutionService {
  private apiBaseUrl = 'https://pokeapi.co/api/v2';

  /** Cache mega forms by *species id* to avoid re-fetching every battle. */
  private megaFormsBySpeciesId = new Map<number, Observable<MegaForm[]>>();

  /** Only one Mega per battle (by design). */
  private currentMegaPokemon: PokemonItem | null = null;

  constructor(
    private http: HttpClient,
    private pokemonService: PokemonService,
    private trainerService: TrainerService,
  ) {}

  /**
   * Returns all Mega forms available for the given Pokémon (including any new forms
   * added to PokeAPI, e.g. Legends: Z-A + DLC).
   */
  getMegaFormsForPokemon(pokemon: PokemonItem): Observable<MegaForm[]> {
    const speciesId = pokemon.basePokemonId ?? pokemon.pokemonId;

    // Mega Evolutions only exist for valid species ids (National Dex style).
    // If we don't know the base species for a form, just treat it as having no Mega.
    if (!Number.isFinite(speciesId) || speciesId <= 0 || speciesId > 20000) {
      return of([]);
    }

    const cached = this.megaFormsBySpeciesId.get(speciesId);
    if (cached) {
      return cached;
    }

    const request$ = this.http
      .get<PokemonSpeciesResponse>(`${this.apiBaseUrl}/pokemon-species/${speciesId}`)
      .pipe(
        map((response) => {
          const megaVarieties = (response?.varieties ?? []).filter((v) =>
            v?.pokemon?.name?.includes('-mega')
          );

          const megas: MegaForm[] = megaVarieties
            .map((v) => {
              const apiName = v.pokemon.name;
              const pokemonId = this.extractIdFromUrl(v.pokemon.url);
              if (!pokemonId) {
                return null;
              }
              return {
                pokemonId,
                apiName,
                displayName: this.formatMegaDisplayName(apiName),
              } as MegaForm;
            })
            .filter((m): m is MegaForm => m !== null)
            // keep a stable order so the roulette doesn't feel random *before* spinning
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

          return megas;
        }),
        catchError((error) => {
          console.error('Failed to fetch mega forms for species', speciesId, error);
          return of([] as MegaForm[]);
        }),
        shareReplay(1)
      );

    this.megaFormsBySpeciesId.set(speciesId, request$);
    return request$;
  }

  /**
   * Applies Mega Evolution for the current battle.
   * The Pokémon is reverted automatically when `revertCurrentMegaEvolution()` is called.
   */
  megaEvolveForBattle(pokemon: PokemonItem, megaForm: MegaForm): Observable<void> {
    // If there is already a Mega active (shouldn't happen), revert first.
    this.revertCurrentMegaEvolution();

    // Backup original state so we can revert after battle.
    pokemon.megaBackup = {
      text: pokemon.text,
      sprite: pokemon.sprite,
      power: pokemon.power,
    };

    const megaPower: 5 | 6 = (pokemon.power === 5 ? 6 : 5);

    return this.pokemonService.getPokemonSprites(megaForm.pokemonId).pipe(
      map((result) => {
        pokemon.sprite = result.sprite;
        pokemon.text = megaForm.displayName;
        pokemon.power = megaPower;
        pokemon.isMegaEvolved = true;
        this.currentMegaPokemon = pokemon;

        // Notify UI/subscribers.
        const team = this.trainerService.getTeam();
        this.trainerService.updateTeam();
      }),
      catchError((error) => {
        console.error('Failed to mega evolve', pokemon, megaForm, error);
        // If something fails, revert backup just in case.
        this.revertCurrentMegaEvolution();
        return throwError(() => error);
      })
    );
  }

  /**
   * Reverts the currently Mega-Evolved Pokémon (if any) back to its original form.
   * Call this right after a battle ends.
   */
  revertCurrentMegaEvolution(): void {
    const pokemon = this.currentMegaPokemon;
    if (!pokemon?.megaBackup) {
      this.currentMegaPokemon = null;
      return;
    }

    pokemon.text = pokemon.megaBackup.text;
    pokemon.sprite = pokemon.megaBackup.sprite;
    pokemon.power = pokemon.megaBackup.power;
    pokemon.isMegaEvolved = false;
    delete pokemon.megaBackup;

    this.currentMegaPokemon = null;

    const team = this.trainerService.getTeam();
    this.trainerService.updateTeam();
  }


  /**
   * Backwards-compatible name used by older callers.
   * (Some parts of the UI call `revertMegaEvolution()`.)
   *
   * Prefer `revertCurrentMegaEvolution()` for new code.
   */
  revertMegaEvolution(): void {
    this.revertCurrentMegaEvolution();
  }

  private extractIdFromUrl(url: string): number | null {
    try {
      const parts = url.split('/').filter(Boolean);
      const idStr = parts[parts.length - 1];
      const id = Number(idStr);
      return Number.isFinite(id) ? id : null;
    } catch {
      return null;
    }
  }

  private formatMegaDisplayName(apiName: string): string {
    const parts = apiName.split('-').filter(Boolean);
    const megaIndex = parts.indexOf('mega');

    // Fallback: just Title Case the whole thing.
    if (megaIndex === -1) {
      return this.toTitleCase(parts.join(' '));
    }

    const baseName = parts.slice(0, megaIndex).join(' ');
    const suffixParts = parts.slice(megaIndex + 1);

    const suffix = suffixParts
      .map((p) => (['x', 'y', 'z'].includes(p) ? p.toUpperCase() : this.capitalize(p)))
      .join(' ');

    return `Mega ${this.toTitleCase(baseName)}${suffix ? ` ${suffix}` : ''}`;
  }

  private toTitleCase(str: string): string {
    return str
      .split(' ')
      .filter(Boolean)
      .map((w) => this.capitalize(w))
      .join(' ');
  }

  private capitalize(word: string): string {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
}
