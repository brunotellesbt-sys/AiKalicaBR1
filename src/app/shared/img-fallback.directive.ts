import { Directive, HostListener } from '@angular/core';

/**
 * Prevents "broken image" blanks by swapping the <img> src to a fallback URL when it fails.
 * This is intentionally heuristic-based so we don't have to touch every data file.
 *
 * Variant: bulbagarden-first
 */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: true
})
export class ImgFallbackDirective {
  private tried = new Set<string>();

  @HostListener('error', ['$event'])
  onError(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;

    const current = img.currentSrc || img.src || '';
    if (current) this.tried.add(current);

    const next = this.getNextFallback(current);
    if (!next) return;

    // avoid loops
    if (this.tried.has(next)) return;
    this.tried.add(next);

    img.src = next;
  }

  private getNextFallback(src: string): string | null {
    const placeholder = './place-holder-pixel.png';

    // Empty / undefined src => placeholder
    if (!src || src === 'undefined' || src.endsWith('/undefined')) {
      return placeholder;
    }

    // ===== Trainer images =====
    // If a trainer sprite fails, try another trainer source.
    const isTrainer =
      src.includes('pokemon-roulette-trainer-sprites') ||
      src.includes('play.pokemonshowdown.com/sprites/trainers') ||
      src.includes('archives.bulbagarden.net/media/upload') ||
      src.includes('bulbagarden.net/media/upload');

    if (isTrainer) {
      const showdown = (name: string) => `https://play.pokemonshowdown.com/sprites/trainers/${name}.png`;
      const swap = (url: string) => url.replace(/\/\/?$/, '');

      const candidates: string[] = [];

      // If Gen 9 player sprite specifically fails, try both known good options.
      candidates.push('https://play.pokemonshowdown.com/sprites/trainers/florian-s.png');
      candidates.push('https://play.pokemonshowdown.com/sprites/trainers/juliana-s.png');
      candidates.push('https://archives.bulbagarden.net/media/upload/6/62/Spr_Masters_Florian_2.png');
      candidates.push('https://archives.bulbagarden.net/media/upload/4/4a/Spr_Masters_Juliana.png');

      // If it's a showdown trainer already, try bulbagarden versions (or vice versa)
      if (false) {
        // showdown-first: bulbagarden after
        candidates.push(placeholder);
      } else {
        // bulbagarden-first: showdown after
        candidates.push(placeholder);
      }

      for (const c of candidates.map(swap)) {
        if (c && c !== src && !this.tried.has(c)) return c;
      }
      return placeholder;
    }

    // ===== Pokémon images =====
    // Attempt to swap between PokeAPI sprite variants if something fails.
    const pokeId = this.extractPokemonId(src);
    if (pokeId) {
      const candidates: string[] = [];
      // Prefer official artwork, then standard sprites.
      candidates.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`);
      candidates.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`);
      candidates.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokeId}.png`);
      candidates.push(placeholder);

      for (const c of candidates) {
        if (c && c !== src && !this.tried.has(c)) return c;
      }
      return placeholder;
    }

    // ===== Items / badges / misc =====
    // If a "known" external asset fails, show placeholder rather than a broken icon.
    return placeholder;
  }

  private extractPokemonId(src: string): number | null {
    // Matches .../pokemon/906.png, .../pokemon/shiny/906.png, ...official-artwork/906.png
    const m = src.match(/\/pokemon\/(?:other\/official-artwork\/)?(\d+)\.png/i)
          || src.match(/\/pokemon\/shiny\/(\d+)\.png/i)
          || src.match(/official-artwork\/(\d+)\.png/i);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) ? id : null;
  }
}
