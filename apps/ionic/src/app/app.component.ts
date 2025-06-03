import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  loading = true;
  isAuthenticated = false;
  name = '';
  currentRoute = '';

  constructor(
    protected strivacityAuthService: StrivacityAuthService,
    private router: Router,
  ) {
    this.strivacityAuthService.session$.subscribe((session) => {
      this.loading = session.loading;
      this.isAuthenticated = session.isAuthenticated;
      this.name = `${session.idTokenClaims?.['given_name']} ${session.idTokenClaims?.['family_name']}`;
    });

    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
    });
  }
}
