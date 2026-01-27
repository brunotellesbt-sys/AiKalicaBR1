import { Component, EventEmitter, Output } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { evolutionChain } from '../../../../services/evolution-service/evolution-chain';
import { RESTRICTED_FROM_TRADE_AND_EGGS } from '../../../../services/pokemon-service/pokemon-obtainability';

@Component({
  selector: 'app-mysterious-egg-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './mysterious-egg-roulette.component.html',
  styleUrl: './mysterious-egg-roulette.component.css'
})
export class MysteriousEggRouletteComponent {

  /**
   * Mystery Egg rules:
   * - Only base-stage Pokémon (no evolved forms)
   * - No Legendary/Mythical/Ultra Beast Pokémon
   * - No Paradox Pokémon
   * - Exception: Phione (489) is allowed
   */
  constructor(pokemonService: PokemonService) {
    const allPokemon = pokemonService.getAllPokemon();

    // All Pokémon that appear as an evolution result (i.e., not base-stage)
    const evolvedIds = new Set<number>();
    Object.values(evolutionChain).forEach((evolutions) => {
      evolutions.forEach((id) => evolvedIds.add(id));
    });

    // Legendary/Mythical IDs (National Dex)
    // (Ultra Beasts are handled separately below so we can exclude them everywhere we want.)
    const legendaryIds = new Set<number>([
      // Gen 1
      144, 145, 146, 150, 151,
      // Gen 2
      243, 244, 245, 249, 250, 251,
      // Gen 3
      377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
      // Gen 4
      480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
      // Gen 5
      494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
      // Gen 6
      716, 717, 718, 719, 720, 721,
      // Gen 7 (Legendaries + Mythicals)
      772, 773, 785, 786, 787, 788, 789, 790, 791, 792,
      800, 801, 802,
      807, 808, 809,
      // Gen 8
      888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905,
      // Gen 9 (including DLC)
      1001, 1002, 1003, 1004,
      1007, 1008,
      1009, 1010,
      1014, 1015, 1016, 1017,
      1020, 1021, 1022, 1023,
      1024, 1025
    ]);

    // Ultra Beasts (National Dex)
    const ultraBeastIds = new Set<number>([
      793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806
    ]);

    // Paradox Pokémon IDs (National Dex)
    // (We also add a defensive range-based check below in case any dataset entry is off.)
    const paradoxIds = new Set<number>([
      984, 985, 986, 987, 988, 989,
      990, 991, 992, 993, 994, 995,
      1005, 1006,
      1009, 1010,
      1020, 1021, 1022, 1023,
    ]);

    const phioneId = 489;

    const isParadox = (id: number): boolean => {
      // Defensive fallback: all Paradox are in these known ranges
      return paradoxIds.has(id) || (id >= 984 && id <= 1006) || id === 1009 || id === 1010 || (id >= 1020 && id <= 1023);
    };

    this.eggPokemon = allPokemon
      .filter((p) => !RESTRICTED_FROM_TRADE_AND_EGGS.has(p.pokemonId))
      .filter((p) => !evolvedIds.has(p.pokemonId))
      .filter((p) => (!legendaryIds.has(p.pokemonId) && !ultraBeastIds.has(p.pokemonId)) || p.pokemonId === phioneId)
      .filter((p) => !isParadox(p.pokemonId));
  }

	eggPokemon: PokemonItem[] = [];

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  onItemSelected(index: number): void {
    const selectedPokemon = this.eggPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
