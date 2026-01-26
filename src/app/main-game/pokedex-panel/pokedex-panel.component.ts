import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';

type PokedexRow = {
  id: number;
  name: string;
  power: number;
  imgUrl: string;
  loading: boolean;
  heightM?: number;
  weightKg?: number;
  descriptionPt?: string;
};

@Component({
  selector: 'app-pokedex-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pokedex-panel.component.html',
  styleUrl: './pokedex-panel.component.css'
})
export class PokedexPanelComponent implements OnInit {
  private apiBaseUrl = 'https://pokeapi.co/api/v2';

  isOpen = false;
  search = '';

  pageSize = 30;
  pageIndex = 0;

  allRows: PokedexRow[] = [];
  visibleRows: PokedexRow[] = [];

  private pokemonCache = new Map<number, { heightM: number; weightKg: number }>();
  private speciesCache = new Map<number, { descriptionPt: string }>();

  constructor(private http: HttpClient, private pokemonService: PokemonService) {}

  ngOnInit(): void {
    // Build a stable 1..1025 list with power taken from the game's National Dex dataset.
    const dex = this.pokemonService.getAllPokemon();
    const powerById = new Map<number, number>(dex.map((p) => [p.pokemonId, p.power]));
    const nameById = new Map<number, string>(dex.map((p) => [p.pokemonId, this.prettyName(p.text)]));

    this.allRows = Array.from({ length: 1025 }, (_, i) => {
      const id = i + 1;
      return {
        id,
        name: nameById.get(id) ?? `#${id}`,
        power: powerById.get(id) ?? 1,
        imgUrl: this.officialArtworkUrl(id),
        loading: false
      };
    });

    this.refreshVisibleRows();
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.refreshVisibleRows();
    }
  }

  onSearchChange(): void {
    this.pageIndex = 0;
    this.refreshVisibleRows();
  }

  prevPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.refreshVisibleRows();
    }
  }

  nextPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.filteredRows().length / this.pageSize) - 1);
    if (this.pageIndex < maxPage) {
      this.pageIndex += 1;
      this.refreshVisibleRows();
    }
  }

  pageLabel(): string {
    const total = this.filteredRows().length;
    const from = total === 0 ? 0 : this.pageIndex * this.pageSize + 1;
    const to = Math.min(total, (this.pageIndex + 1) * this.pageSize);
    return `${from}–${to} / ${total}`;
  }

  private refreshVisibleRows(): void {
    const rows = this.filteredRows();
    const start = this.pageIndex * this.pageSize;
    this.visibleRows = rows.slice(start, start + this.pageSize);
    this.loadDetailsForVisibleRows();
  }

  filteredRows(): PokedexRow[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.allRows;
    const idQuery = Number(q);
    if (!Number.isNaN(idQuery) && idQuery > 0) {
      return this.allRows.filter((r) => r.id === idQuery);
    }
    return this.allRows.filter((r) => r.name.toLowerCase().includes(q));
  }

  private loadDetailsForVisibleRows(): void {
    const toFetch = this.visibleRows.filter((r) => !this.pokemonCache.has(r.id) || !this.speciesCache.has(r.id));
    if (toFetch.length === 0) {
      this.hydrateFromCache(this.visibleRows);
      return;
    }

    toFetch.forEach((r) => (r.loading = true));

    const requests = toFetch.map((row) => {
      const pokemon$ = this.http.get<any>(`${this.apiBaseUrl}/pokemon/${row.id}`).pipe(
        map((p) => ({
          heightM: (p.height ?? 0) / 10,
          weightKg: (p.weight ?? 0) / 10
        })),
        catchError(() => of({ heightM: undefined, weightKg: undefined }))
      );

      const species$ = this.http.get<any>(`${this.apiBaseUrl}/pokemon-species/${row.id}`).pipe(
        map((s) => ({
          descriptionPt: this.pickPortugueseFlavorText(s?.flavor_text_entries ?? [])
        })),
        catchError(() => of({ descriptionPt: '' }))
      );

      return forkJoin([pokemon$, species$]).pipe(
        map(([pokemon, species]) => ({
          id: row.id,
          pokemon,
          species
        }))
      );
    });

    forkJoin(requests).subscribe((results) => {
      results.forEach((res) => {
        if (res.pokemon?.heightM !== undefined && res.pokemon?.weightKg !== undefined) {
          this.pokemonCache.set(res.id, { heightM: res.pokemon.heightM, weightKg: res.pokemon.weightKg });
        }
        if (res.species?.descriptionPt !== undefined) {
          this.speciesCache.set(res.id, { descriptionPt: res.species.descriptionPt });
        }
      });

      this.hydrateFromCache(this.visibleRows);
      this.visibleRows.forEach((r) => (r.loading = false));
    });
  }

  private hydrateFromCache(rows: PokedexRow[]): void {
    rows.forEach((r) => {
      const p = this.pokemonCache.get(r.id);
      if (p) {
        r.heightM = p.heightM;
        r.weightKg = p.weightKg;
      }
      const s = this.speciesCache.get(r.id);
      if (s) {
        r.descriptionPt = s.descriptionPt;
      }
    });
  }

  private pickPortugueseFlavorText(entries: any[]): string {
    // Prefer PT if available, otherwise fall back to EN.
    const normalize = (t: string) => (t ?? '').replace(/\f/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    const pt = entries
      .filter((e) => e?.language?.name === 'pt')
      // Prefer modern versions if present.
      .sort((a, b) => {
        const score = (v: any) => {
          const name = v?.version?.name ?? '';
          if (name === 'scarlet' || name === 'violet') return 3;
          if (name === 'sword' || name === 'shield') return 2;
          return 1;
        };
        return score(b) - score(a);
      });

    const chosen = pt[0]?.flavor_text;
    if (chosen) return normalize(chosen);

    const en = entries.find((e) => e?.language?.name === 'en')?.flavor_text;
    return normalize(en ?? '');
  }

  private officialArtworkUrl(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  private prettyName(text: string): string {
    // Convert keys like "pokemon.tapu-koko" into a readable name
    if (!text) return '';
    if (!text.startsWith('pokemon.')) return text;
    const raw = text.replace(/^pokemon\./, '');
    return raw
      .split('-')
      .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
}
