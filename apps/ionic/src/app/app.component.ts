import { Component } from '@angular/core';
import { IonApp, IonContent, IonHeader, IonRouterOutlet, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [IonApp, IonRouterOutlet, IonContent, IonHeader, IonTitle, IonToolbar],
})
export class AppComponent {
  loading = true;
  isAuthenticated = false;
  name = '';

  constructor(protected strivacityAuthService: StrivacityAuthService) {
    this.strivacityAuthService.session$.subscribe((session) => {
      this.loading = session.loading;
      this.isAuthenticated = session.isAuthenticated;
      this.name = `${session.idTokenClaims?.['given_name']} ${session.idTokenClaims?.['family_name']}`;
    });
  }
}
