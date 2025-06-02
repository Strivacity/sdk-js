import { Routes } from '@angular/router';
import { HomePage } from './pages/home';

export const routes: Routes = [
  { path: '', component: HomePage },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
