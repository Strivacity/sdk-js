import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { type RedirectFlow, StrivacityAuthService } from '@strivacity/sdk-angular';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { AppNavComponent } from '../../components/app-nav/app-nav.component';

@Component({
  standalone: true,
  selector: 'app-revoke-page',
  templateUrl: './revoke.page.html',
  imports: [IonContent, AppHeaderComponent, AppNavComponent],
})
export class RevokePage {
  readonly subscription = new Subscription();

  constructor(
    protected router: Router,
    @SkipSelf() protected strivacityAuthService: StrivacityAuthService<RedirectFlow>,
  ) {}

  ngOnInit(): void {
    this.strivacityAuthService.revoke().subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
