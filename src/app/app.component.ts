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
    // English-only build
    this.translate.addLangs(['en']);
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }

  changeLang(lang: string) {
    // Keep method for template compatibility; ignore non-English.
    if (lang === 'en') {
      this.translate.use('en');
    }
  }
}
