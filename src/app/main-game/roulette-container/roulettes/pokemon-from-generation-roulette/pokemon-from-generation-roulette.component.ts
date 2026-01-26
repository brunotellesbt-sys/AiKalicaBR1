import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { pokemonByGeneration } from './pokemon-by-generation';
import { Subscription } from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { RESTRICTED_FROM_RANDOM_OBTAIN } from '../../../../services/pokemon-service/pokemon-obtainability';

@Component({
  selector: 'app-pokemon-from-generation-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './pokemon-from-generation-roulette.component.html',
  styleUrl: './pokemon-from-generation-roulette.component.css'
})
export class PokemonFromGenerationRouletteComponent implements OnInit, OnDestroy {

  constructor(private generationService: GenerationService) {
  }

  pokemonByGeneration = pokemonByGeneration;

  // Gen 9: Paradox + legendary Pokémon must NOT appear in normal Catch Pokémon.
  private readonly gen9ParadoxIds = new Set<number>([984,985,986,987,988,989,990,991,992,993,994,995,1005,1006,1009,1010,1020,1021,1022,1023]);
  private readonly gen9LegendaryIds = new Set<number>([1001,1002,1003,1004,1007,1008,1014,1015,1016,1017,1024,1025]);

  /**
   * IMPORTANT:
   * The WheelComponent redraws when the @Input array reference changes.
   * If we create a new array on every change detection cycle (e.g. via .filter()),
   * the wheel can look like it "doesn't spin" because it keeps being redrawn at
   * rotation 0 while the animation is running.
   *
   * So we compute the list ONCE per generation change and keep a stable reference.
   */
  wheelItems: PokemonItem[] = [];

  generation!: GenerationItem;
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  private generationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      this.wheelItems = this.buildWheelItems();
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.wheelItems[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }

  private buildWheelItems(): PokemonItem[] {
    const list = this.pokemonByGeneration[this.generation?.id] ?? [];

    // Build filtered arrays ONCE per generation change (stable reference during spins).
    const withoutRestricted = list.filter(p => !RESTRICTED_FROM_RANDOM_OBTAIN.has(p.pokemonId));

    if (this.generation?.id === 9) {
      // Gen 9: Paradox + legendary Pokémon must NOT appear in normal Catch Pokémon.
      return withoutRestricted.filter(p => !this.gen9ParadoxIds.has(p.pokemonId) && !this.gen9LegendaryIds.has(p.pokemonId));
    }

    return withoutRestricted;
  }
}
