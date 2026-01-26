import { Component, EventEmitter, Output } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { RESTRICTED_FROM_TRADE_AND_EGGS } from '../../../../services/pokemon-service/pokemon-obtainability';

@Component({
  selector: 'app-trade-pokemon-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './trade-pokemon-roulette.component.html',
  styleUrl: './trade-pokemon-roulette.component.css'
})
export class TradePokemonRouletteComponent {

  constructor(pokemonService: PokemonService) {
    this.nationalDexPokemon = pokemonService.getAllPokemon()
      .filter((pokemon) => !RESTRICTED_FROM_TRADE_AND_EGGS.has(pokemon.pokemonId));
  }

  nationalDexPokemon: PokemonItem[];

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  onItemSelected(index: number): void {
    const selectedPokemon = this.nationalDexPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
