import { Component, SkipSelf } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Session, StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
  standalone: true,
  selector: 'app-profile-page',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [JsonPipe, DatePipe],
})
export class ProfilePage {
  readonly subscription = new Subscription();
  session: Session = {
    loading: true,
    isAuthenticated: false,
    idTokenClaims: null,
    accessToken: null,
    refreshToken: null,
    accessTokenExpired: false,
    accessTokenExpirationDate: null,
  };

  constructor(@SkipSelf() protected strivacityAuthService: StrivacityAuthService) {
    this.strivacityAuthService.session$.subscribe((session) => {
      this.session = session;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
