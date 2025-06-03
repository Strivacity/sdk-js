import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { AppNavComponent } from '../../components/app-nav/app-nav.component';

@Component({
  standalone: true,
  selector: 'app-logout-page',
  templateUrl: './logout.page.html',
  imports: [IonContent, AppHeaderComponent, AppNavComponent],
})
export class LogoutPage {
  readonly subscription = new Subscription();

  constructor(
    protected router: Router,
    @SkipSelf() protected strivacityAuthService: StrivacityAuthService,
  ) {}

  ngOnInit(): void {
    this.strivacityAuthService.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
