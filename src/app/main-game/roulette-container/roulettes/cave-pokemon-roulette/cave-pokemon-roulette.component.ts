import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { cavePokemonByGeneration } from './cave-pokemon-by-generation';
import { Subscription } from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { RESTRICTED_FROM_RANDOM_OBTAIN } from '../../../../services/pokemon-service/pokemon-obtainability';

@Component({
  selector: 'app-cave-pokemon-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './cave-pokemon-roulette.component.html',
  styleUrl: './cave-pokemon-roulette.component.css'
})
export class CavePokemonRouletteComponent implements OnInit, OnDestroy {


  constructor(private generationService: GenerationService) {
  }

  cavePokemonByGeneration = cavePokemonByGeneration;

  // Safety: Gen 9 Paradox + legendary Pokémon must NOT appear in Cave Catch.
  private readonly gen9ParadoxIds = new Set<number>([984,985,986,987,988,989,990,991,992,993,994,995,1005,1006,1009,1010,1020,1021,1022,1023]);
  private readonly gen9LegendaryIds = new Set<number>([1001,1002,1003,1004,1007,1008,1014,1015,1016,1017,1024,1025]);

  /**
   * Keep a stable list reference for the wheel while spinning.
   * (Avoid creating a new filtered array on every change detection cycle.)
   */
  wheelItems: PokemonItem[] = [];

  @Input() generation!: GenerationItem;
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
    const baseList = this.cavePokemonByGeneration[this.generation?.id] ?? [];
    let list = baseList.filter(p => !RESTRICTED_FROM_RANDOM_OBTAIN.has(p.pokemonId));

    if (this.generation?.id === 9) {
      list = list.filter(p => !this.gen9ParadoxIds.has(p.pokemonId) && !this.gen9LegendaryIds.has(p.pokemonId));
    }

    return list;
  }
}
