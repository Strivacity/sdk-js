import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { provideStrivacity } from '@strivacity/sdk-angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

interface ImportMeta {
  env: {
    VITE_ISSUER: string;
    VITE_SCOPES: string;
    VITE_CLIENT_ID: string;
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: RouteReuseStrategy,
      useClass: IonicRouteStrategy,
    },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideStrivacity({
      mode: 'redirect',
      issuer: 'https://uat.strivacity.cloud',
      scopes: ['openid', 'profile', 'offline'],
      clientId: '2202c596c06e4774b42804a106c66df9',
      redirectUri: 'http://localhost:8101/callback',
      storageTokenName: 'sty.session.angular',
    }),
  ],
});
