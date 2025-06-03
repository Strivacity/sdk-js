import { Component, NgZone } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';

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
    private ngZone: NgZone,
  ) {
    this.strivacityAuthService.session$.subscribe((session) => {
      this.loading = session.loading;
      this.isAuthenticated = session.isAuthenticated;
      this.name = `${session.idTokenClaims?.['given_name']} ${session.idTokenClaims?.['family_name']}`;
    });

    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
    });

    // Initialize the app with deep link handling
    this.initializeApp();
  }

  initializeApp() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.ngZone.run(() => {
        console.log('App opened with URL:', event.url);

        // Handle the deeplink URL with our scheme
        if (event.url.startsWith('strivacityionic.example://callback')) {
          console.log('Authentication callback received via deeplink');

          try {
            // Extract the query parameters from the deeplink URL
            const url = new URL(event.url);
            const queryParams = url.search.substring(1); // Remove the '?' at the beginning

            // Redirect to the callback route with the same query parameters
            this.router.navigateByUrl(`/callback?${queryParams}`);
          } catch (error) {
            console.error('Failed to process deeplink URL', error);
          }
        }
      });
    });
  }
}
