import { sdk } from '../lib/auth/server';
import { sdkOptions } from '../lib/auth/options';
import { GuardedProfile, ProfileView } from './client';

// This demo shows both session modes side by side.
// in your own app, keep only the branch matching your `serverSessionUri` setting.
// Server-managed: guard on the server. An expired session is sent through /auth/refresh (which can write the rotated cookie)
// and comes back here; the browser SDK never refreshes in this mode.
const ProfilePage = sdkOptions.serverSessionUri ? sdk.withAuthGuard(() => <ProfileView />, { returnTo: '/profile' }) : GuardedProfile;

export default ProfilePage;
