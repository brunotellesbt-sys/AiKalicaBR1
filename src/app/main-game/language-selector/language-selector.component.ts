import {Component, inject} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Language } from '../../interfaces/language';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import {NgIcon} from '@ng-icons/core';

@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.css',
  imports: [
    NgbDropdownModule,
    NgIcon
  ],
  standalone: true
})
export class LanguageSelectorComponent {
  private translateService = inject(TranslateService);

  languages: Language[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ]

  currentLanguage: Language = this.languages[0];

  constructor() {
    const currentLanguage = this.translateService.currentLang || this.translateService.getDefaultLang() || 'en';
    this.updateCurrentLanguage(currentLanguage)
    this.translateService.onLangChange.subscribe(event => {
      this.updateCurrentLanguage(event.lang);
    });
  }

  changeLanguage(languageCode: string): void {
    // English-only build
    this.translateService.use('en');
    this.updateCurrentLanguage('en');
    localStorage.setItem('language', 'en');
  }

  private updateCurrentLanguage(languageCode: string): void {
    const language = this.languages.find(lang => lang.code === languageCode);
    if (language) {
      this.currentLanguage = language;
    }
  }
}
