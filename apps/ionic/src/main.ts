import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { provideStrivacity } from '@strivacity/sdk-angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

function getRedirectUri() {
  // More reliable check for Capacitor environment
  const isCapacitorNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();
  let redirectUri: string;

  if (isCapacitorNative) {
    // Configure in Xcode and in Android Studio (look at the README)
    redirectUri = 'strivacityionic.example://callback';
  } else {
    redirectUri = `${window.location.origin}/callback`;
  }

  console.log('window.location.protocol:', window.location.protocol);
  console.log('Redirect URI:', redirectUri);
  return redirectUri;
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
