import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
  selector: 'app-nav',
  templateUrl: './app-nav.component.html',
  standalone: true,
  imports: [RouterLink],
})
export class AppNavComponent {
  isAuthenticated = false;
  currentRoute = '';

  constructor(
    private strivacityAuthService: StrivacityAuthService,
    private router: Router,
  ) {
    this.strivacityAuthService.session$.subscribe((session) => {
      this.isAuthenticated = session.isAuthenticated;
    });

    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
    });
  }
}
