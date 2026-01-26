import { Component, EventEmitter, OnDestroy, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { map, Subscription, forkJoin } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { MegaEvolutionService, MegaForm } from '../../../../services/mega-evolution-service/mega-evolution.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { AudioService } from '../../../../services/audio-service/audio.service';

type MegaRouletteMode = 'select-pokemon' | 'select-mega-form';

@Component({
  selector: 'app-mega-evolution-roulette',
  imports: [WheelComponent, TranslatePipe, NgIf, NgFor],
  templateUrl: './mega-evolution-roulette.component.html',
  styleUrl: './mega-evolution-roulette.component.css'
})
export class MegaEvolutionRouletteComponent implements OnInit, OnDestroy {
  @Output() megaEvolutionFinished = new EventEmitter<void>();

  @ViewChild('megaEvolutionModal') megaEvolutionModal!: TemplateRef<any>;

  mode: MegaRouletteMode = 'select-pokemon';
  wheelTitle = 'Mega Evolution';

  isLoading = true;

  /** Candidates: team Pokémon that can Mega Evolve and their available Mega forms. */
  private megaCandidates: Array<{ pokemon: PokemonItem; megaForms: MegaForm[] }> = [];

  /** Current wheel items (either Pokémon or Mega forms). */
  wheelItems: any[] = [];

  /** When selecting a Mega form, this is the Pokémon chosen in the previous wheel. */
  private selectedPokemonForMega: PokemonItem | null = null;

  /** Data for the popup. */
  popupBeforePokemon: PokemonItem | null = null;
  popupAfterName = '';
  popupAfterSpriteUrl = '';
  popupMegaTypes: string[] = [];

  private subs = new Subscription();
  private modalRef: NgbModalRef | null = null;

  // Audio elements
  megaEvolutionAudio!: HTMLAudioElement;

  constructor(
    private trainerService: TrainerService,
    private megaEvolutionService: MegaEvolutionService,
    private modalService: NgbModal,
    private audioService: AudioService
  ) {}

  ngOnInit(): void {
    // Initialize audio
    this.megaEvolutionAudio = this.audioService.createAudio('./mega-evolution.mp3');
    const team = this.trainerService.getTeam();

    if (!team || team.length === 0) {
      // Nothing to do; proceed directly.
      this.isLoading = false;
      this.megaEvolutionFinished.emit();
      return;
    }

    // Fetch Mega forms for each Pokémon in the team.
    const requests = team.map((p) =>
      this.megaEvolutionService.getMegaFormsForPokemon(p)
        .pipe(
          // Map to a consistent structure.
          // (We keep the same Pokémon object reference so we can mutate it for battle.)
          map((forms) => ({ pokemon: p, megaForms: forms }))
        )
    );

    const sub = forkJoin(requests).subscribe({
      next: (results) => {
        this.megaCandidates = results.filter((r) => (r.megaForms?.length ?? 0) > 0);

        this.isLoading = false;

        if (this.megaCandidates.length === 0) {
          // Team has no Mega-capable Pokémon; skip this state.
          this.megaEvolutionFinished.emit();
          return;
        }

        this.mode = 'select-pokemon';
        this.wheelTitle = 'Mega Evolution';
        this.wheelItems = this.megaCandidates.map((c) => c.pokemon);
      },
      error: () => {
        this.isLoading = false;
        // If anything fails, don't block the game.
        this.megaEvolutionFinished.emit();
      }
    });

    this.subs.add(sub);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.modalRef?.close();
  }

  onItemSelected(index: number): void {
    if (this.isLoading) return;

    if (this.mode === 'select-pokemon') {
      const candidate = this.megaCandidates[index];
      if (!candidate) {
        this.megaEvolutionFinished.emit();
        return;
      }

      this.selectedPokemonForMega = candidate.pokemon;

      if ((candidate.megaForms?.length ?? 0) <= 1) {
        // Only one Mega form; apply immediately.
        const megaForm = candidate.megaForms[0];
        this.applyMegaEvolution(candidate.pokemon, megaForm);
        return;
      }

      // Multiple Mega forms: spin another roulette between them.
      this.mode = 'select-mega-form';
      this.wheelTitle = 'Mega Evolution';
      this.wheelItems = candidate.megaForms.map((f) => ({
        text: f.displayName,
        fillStyle: candidate.pokemon.fillStyle,
        weight: 1,
        _megaForm: f,
      }));
      return;
    }

    // Selecting the Mega form.
    const selected = this.wheelItems[index] as any;
    const megaForm: MegaForm | undefined = selected?._megaForm;

    if (!this.selectedPokemonForMega || !megaForm) {
      this.megaEvolutionFinished.emit();
      return;
    }

    this.applyMegaEvolution(this.selectedPokemonForMega, megaForm);
  }

  private applyMegaEvolution(pokemon: PokemonItem, megaForm: MegaForm): void {
    // Play mega evolution sound effect
    this.audioService.playAudio(this.megaEvolutionAudio, 0.7);

    // Prepare popup before we mutate the Pokémon.
    this.popupBeforePokemon = pokemon;
    this.popupAfterName = megaForm.displayName;

    // Fetch types for animation
    const typesSub = this.megaEvolutionService.getPokemonTypes(megaForm.pokemonId).subscribe({
      next: (types) => {
        this.popupMegaTypes = types;
      },
      error: () => {
        this.popupMegaTypes = [];
      }
    });

    const sub = this.megaEvolutionService.megaEvolveForBattle(pokemon, megaForm).subscribe({
      next: () => {
        // Build the image URL for the "after" sprite.
        // (At this point, the Pokémon object has already been updated.)
        const sprite = pokemon.sprite;
        this.popupAfterSpriteUrl = pokemon.shiny
          ? (sprite?.front_shiny || sprite?.front_default || '')
          : (sprite?.front_default || '');

        this.openMegaPopupAndProceed();
      },
      error: () => {
        // If it fails, proceed without Mega.
        this.megaEvolutionFinished.emit();
      }
    });

    this.subs.add(sub);
    this.subs.add(typesSub);
  }

  private openMegaPopupAndProceed(): void {
    try {
      this.modalRef = this.modalService.open(this.megaEvolutionModal, {
        centered: true,
        backdrop: 'static',
        keyboard: false,
      });

      // Play the mega evolution cry from Pokemon Showdown
      this.playMegaCry();

      // Auto-close after a short moment to keep the game flow fast.
      setTimeout(() => {
        try {
          this.modalRef?.close();
        } finally {
          this.megaEvolutionFinished.emit();
        }
      }, 2500); // Increased to allow for animation
    } catch {
      // If modal fails (shouldn't), just proceed.
      this.megaEvolutionFinished.emit();
    }
  }

  private playMegaCry(): void {
    if (!this.popupAfterName) return;
    
    // Convert display name to Pokemon Showdown format
    // e.g., "Mega Charizard X" -> "charizard-mega-x"
    const pokemonName = this.popupAfterName
      .toLowerCase()
      .replace('mega ', '')
      .trim()
      .replace(/\s+/g, '-');
    
    const cryUrl = `https://play.pokemonshowdown.com/audio/cries/${pokemonName}-mega.mp3`;
    
    const cryAudio = this.audioService.createAudio(cryUrl);
    
    // Play cry after a short delay (after the transformation)
    setTimeout(() => {
      this.audioService.playAudio(cryAudio, 0.6);
    }, 800);
  }
}
