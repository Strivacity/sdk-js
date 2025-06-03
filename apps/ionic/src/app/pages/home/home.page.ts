import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { AppNavComponent } from '../../components/app-nav/app-nav.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  imports: [IonContent, AppHeaderComponent, AppNavComponent],
})
export class HomePage {
  constructor() {}
}
