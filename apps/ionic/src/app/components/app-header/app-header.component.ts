import { Component } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  standalone: true,
  imports: [IonHeader, IonTitle, IonToolbar],
})
export class AppHeaderComponent {
  isAuthenticated = false;
  loading = true;
  name = '';

  constructor(private strivacityAuthService: StrivacityAuthService) {
    this.strivacityAuthService.session$.subscribe((session) => {
      this.loading = session.loading;
      this.isAuthenticated = session.isAuthenticated;
      this.name = `${session.idTokenClaims?.['given_name']} ${session.idTokenClaims?.['family_name']}`;
    });
  }
}
