import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TranslateModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'pokemon-roulette';

  constructor(private translate: TranslateService) {
    // Set up supported languages
    this.translate.addLangs(['en', 'pt', 'es', 'fr']);
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }

  changeLang(lang: string) {
    // Support all languages
    this.translate.use(lang);
  }
}
