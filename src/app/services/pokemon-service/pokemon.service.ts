import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, retry, throwError } from 'rxjs';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { nationalDexPokemon } from './national-dex-pokemon';

@Injectable({
  providedIn: 'root'
})
export class PokemonService {

  constructor(private http: HttpClient) { }

  private apiBaseUrl = 'https://pokeapi.co/api/v2';
  nationalDexPokemon = nationalDexPokemon;

  /**
   * Fetches the sprites for a given Pokémon by ID.
   * @param pokemonId The ID of the Pokémon.
   * @returns An Observable of the sprite URLs.
   */
  getPokemonSprites(pokemonId: number): Observable<{ sprite: { front_default: string; front_shiny: string; }; }> {
    const url = `${this.apiBaseUrl}/pokemon/${pokemonId}`;
    return this.http.get<any>(url).pipe(
      retry({
        count: 3,    // Retry up to 3 times
        delay: 1000  // Wait 1 second between retries
      }),
      map((response) => {
        const artwork = response?.sprites?.other?.['official-artwork'];

        // Primary: official artwork.
        // Fallback: regular front sprites (some forms might be missing official artwork).
        const fallback_default: string = response?.sprites?.front_default ?? '';
        const fallback_shiny: string = response?.sprites?.front_shiny ?? '';

        const front_default: string = artwork?.front_default || fallback_default || '';

        // Some forms (including a few Mega / special forms) may not have a dedicated
        // shiny artwork in the PokeAPI response. In that case, fall back to the
        // non-shiny artwork so the UI never breaks.
        const front_shiny_raw: string = artwork?.front_shiny || fallback_shiny || '';
        const front_shiny: string = front_shiny_raw || front_default;

        return {
          sprite: {
            front_default,
            front_shiny,
          }
        };
      }),
      catchError((error) => {
        console.error(`Failed to fetch Pokémon ${pokemonId}:`, error);
        return throwError(() => new Error('Failed to fetch Pokémon data'));
      })
    );
  }

  getPokemonById(pokemonId: number): PokemonItem | undefined {
    const pokemon = this.nationalDexPokemon.find(pokemon => pokemon.pokemonId === pokemonId);
    return pokemon;
  }

  getAllPokemon(): PokemonItem[] {
    return this.nationalDexPokemon;
  }
}