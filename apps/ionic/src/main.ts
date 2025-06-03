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

function getRedirectUri() {
  // Check if the app is loaded with capacitor:// schema
  const isCapacitorApp = window.location.protocol === 'capacitor:';

  if (isCapacitorApp) {
    // Use the URL scheme configured in Xcode
    return 'strivacityionic.example://callback';
  } else {
    // Use dynamic origin for web (includes protocol, hostname, and port)
    return `${window.location.origin}/callback`;
  }
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
      redirectUri: getRedirectUri(),
      storageTokenName: 'sty.session.angular',
    }),
  ],
});
