# Strivacity SDK - Ionic React Example App

This example application demonstrates how to integrate the Strivacity SDK into an Ionic React application with full mobile platform support using Capacitor plugins and native device capabilities.

## Ionic-Specific Enhancements

### Mobile Platform Support with Capacitor

This Ionic React application extends the standard React implementation with Capacitor plugins for mobile platform support:

#### 1. Additional Dependencies

The Ionic version includes additional Capacitor packages for mobile platform functionality (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-react": "*",
	"@capacitor/app": "^7.0.1",
	"@capacitor/inappbrowser": "2.2.0",
	"@capacitor/preferences": "^7.0.1"
}
```

These packages provide:

- **@capacitor/app**: App lifecycle and state management for mobile platforms
- **@capacitor/inappbrowser**: In-app browser functionality for authentication flows
- **@capacitor/preferences**: Native storage capabilities for secure token management

#### 2. Enhanced Provider Configuration

The Ionic version includes Capacitor-specific storage and HTTP client implementations (see [src/main.tsx](./src/main.tsx)):

```tsx
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { InAppBrowser } from '@capacitor/inappbrowser';

// Custom HTTP client for mobile platforms
class CapacitorHttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const response = await CapacitorHttp.request({
			url,
			method: options?.method || 'GET',
			headers: (options?.headers as Record<string, string>) || {},
			data: options?.body,
			webFetchExtra: options,
		});

		return {
			headers: new Headers(response.headers),
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			statusText: '',
			url: response.url,
			json: () => Promise.resolve(response.data),
			text: () => Promise.resolve(response.data),
		};
	}
}

// Native storage implementation
class CapacitorStorage extends SDKStorage {
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}

	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}

	async delete(key: string): Promise<void> {
		await Preferences.remove({ key });
	}
}
```

#### 3. Platform-Aware SDK Options

The configuration includes platform detection for handling authentication flows differently on web vs mobile:

```tsx
const options: SDKOptions = {
	// ...other config
	storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,
	async urlHandler(url, responseMode) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(url, responseMode);
		} else {
			await InAppBrowser.openInWebView({ url, options: DefaultWebViewOptions });
		}
	},
	async callbackHandler(url, responseMode) {
		if (Capacitor.getPlatform() !== 'web') {
			// InAppBrowser navigation listener implementation
			return new Promise(async (resolve, reject) => {
				// Mobile-specific callback handling with navigation listeners
			});
		} else {
			return redirectCallbackHandler(url, responseMode);
		}
	},
};
```

### 3. Enhanced Authentication Pages

Both login and register pages include mobile-specific fallback handling:

#### Login Page Enhancements ([src/pages/Login.tsx](./src/pages/Login.tsx)):

```tsx
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';

useEffect(() => {
	(async () => {
		if (options.mode === 'redirect') {
			await login();

			// Mobile platform token exchange
			if (Capacitor.getPlatform() !== 'web') {
				const params = await options.callbackHandler!(options.redirectUri, options.responseMode || 'fragment');
				await sdk.tokenExchange(params);
				await navigate('/profile');
			}
		} else if (options.mode === 'popup') {
			await login();
			await navigate('/profile');
		}
	})();
}, []);

const onFallback = async (error: FallbackError) => {
	if (error.url) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(error.url.toString());
		} else {
			// InAppBrowser implementation for mobile platforms
			await InAppBrowser.openInWebView({
				url: error.url.toString(),
				options: DefaultWebViewOptions,
			});

			const params = await new Promise<Record<string, string>>(async (resolve, reject) => {
				let navigationListener: PluginListenerHandle | null = null;
				let finishListener: PluginListenerHandle | null = null;
				let userCancelled = true;

				// Navigation event listeners for mobile authentication flow
				navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
					// Handle redirect URI navigation
					if (event.url?.startsWith(options.redirectUri)) {
						// Extract and process authentication parameters
						userCancelled = false;
						await InAppBrowser.close();
						resolve(params);
					}
				});

				finishListener = await InAppBrowser.addListener('browserClosed', async () => {
					if (userCancelled) {
						reject(new Error('InAppBrowser flow cancelled by user.'));
					}
				});
			});

			// Handle authentication result
			if (params.session_id) {
				await navigate(`/callback?session_id=${params.session_id}`);
			} else {
				await sdk.tokenExchange(params);
				await navigate('/profile');
			}
		}
	}
};
```

#### Register Page Enhancements ([src/pages/Register.tsx](./src/pages/Register.tsx)):

The register page includes identical mobile platform enhancements with the same InAppBrowser handling and platform detection logic.

### 4. Key Differences from Standard React Implementation

| Feature                 | Standard React        | Ionic React                                                         |
| ----------------------- | --------------------- | ------------------------------------------------------------------- |
| **Storage**             | LocalStorage only     | Platform-aware: LocalStorage (web) / Capacitor Preferences (mobile) |
| **HTTP Client**         | Standard fetch        | Platform-aware: fetch (web) / CapacitorHttp (mobile)                |
| **Authentication Flow** | Web redirects only    | Platform-aware: redirects (web) / InAppBrowser (mobile)             |
| **URL Handling**        | Browser navigation    | Platform-aware: browser (web) / InAppBrowser (mobile)               |
| **Callback Handling**   | URL parameter parsing | Platform-aware: URL parsing (web) / navigation listeners (mobile)   |
| **Session Management**  | Browser-based         | Native device storage integration                                   |

### 5. Mobile Platform Features

- **Native Storage**: Uses Capacitor Preferences API for secure token storage on mobile devices
- **InAppBrowser Integration**: Handles authentication flows within the app context on mobile platforms
- **Platform Detection**: Automatically detects and adapts behavior for web, iOS, and Android platforms
- **Navigation Listeners**: Monitors InAppBrowser navigation events for authentication callback handling
- **User Cancellation Handling**: Properly handles user-initiated authentication flow cancellations
- **Session Management**: Platform-appropriate session handling with native capabilities

## Standard React Features

# Strivacity SDK - React Example App

This example application demonstrates how to integrate the Strivacity SDK into a React application using React Router for navigation and modern React patterns including hooks and context.

## Key Features and Implementation

### 1. React Dependencies

This React application uses the Strivacity React SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-react": "*"
}
```

### 2. Provider Pattern Integration

The application uses React's context pattern through the `StyAuthProvider` to provide authentication state throughout the component tree (see [src/main.tsx](./src/main.tsx)):

```tsx
import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-react';

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.react',
};

<StyAuthProvider options={options}>
	<BrowserRouter>
		<Routes>// Routes configuration</Routes>
	</BrowserRouter>
</StyAuthProvider>;
```

### 3. Route Protection

The application implements route guards using React hooks to protect authenticated routes (see [src/main.tsx](./src/main.tsx)):

```tsx
import { useStrivacity } from '@strivacity/sdk-react';

const RouteGuard = ({ children }: { children: React.ReactElement }) => {
	const { loading, isAuthenticated } = useStrivacity();

	if (loading) {
		return <h1>Loading...</h1>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return children;
};
```

### 4. React Router Integration

The application uses React Router for client-side navigation with protected and public routes:

```tsx
<Routes>
	<Route path="/" element={<App />}>
		<Route index element={<Home />} />
		<Route path="login" element={<Login />} />
		<Route path="register" element={<Register />} />
		<Route path="callback" element={<Callback />} />
		<Route
			path="profile"
			element={
				<RouteGuard>
					<Profile />
				</RouteGuard>
			}
		/>
		<Route
			path="logout"
			element={
				<RouteGuard>
					<Logout />
				</RouteGuard>
			}
		/>
		<Route
			path="revoke"
			element={
				<RouteGuard>
					<Revoke />
				</RouteGuard>
			}
		/>
	</Route>
</Routes>
```

## Installation and Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables Setup

Create a `.env.local` file in the repository root:

```env
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:3000/callback
VITE_MODE=redirect
```

### 3. Running the Application

```bash
pnpm app:react:serve
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated using React's provider pattern, making authentication state available throughout the component tree (see [src/main.tsx](./src/main.tsx)).

### Component Usage

React components can access authentication state and methods through the `useStrivacity` hook (see [src/components/App.tsx](./src/components/App.tsx)):

```tsx
import { useStrivacity } from '@strivacity/sdk-react';

export function App() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

	return (
		<div>
			{loading && <div>Loading...</div>}
			{isAuthenticated && <div>Welcome, {idTokenClaims?.name}!</div>}
		</div>
	);
}
```

### Pages

Brief, purpose-oriented descriptions of route components under src/pages — what they do, expected behavior, and how they integrate mobile-aware flows (Capacitor / InAppBrowser) via the SDK and React hooks.

- src/pages/Home.tsx

  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Shows public content and, when authenticated, brief user info from useStrivacity(). Should be accessible without auth.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity(); render conditional UI with loading/isAuthenticated.

- src/pages/Login.tsx

  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Triggers the SDK login flow (redirect/popup/native based on options). On web this usually redirects; on mobile open InAppBrowser and exchange tokens when callback is received.
  - Usage: useEffect(() => { await login(); /_ handle mobile token exchange if needed _/ }, []); use options.callbackHandler(...) and sdk.tokenExchange(params) for mobile flows. Use Capacitor.getPlatform() to detect mobile.

- src/pages/Register.tsx

  - Purpose: Registration page (if supported).
  - Behavior: Starts a registration flow or shows a form that calls backend/SDK to create a user. Mobile flows use InAppBrowser fallback similar to login.
  - Usage: call SDK registration API or backend, then call login() / navigate as appropriate.

- src/pages/Entry.tsx

  - Purpose: Entry page used by deep links or external links to start server/SDK-driven operations.
  - Behavior: Calls SDK entry(); if a session_id is returned navigate to /callback?session_id=... otherwise fallback to home. Show loading/error states.
  - Usage: const { entry } = useStrivacity(); call entry() in useEffect, handle returned session_id and navigate.

- src/pages/Callback.tsx

  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Parses query params (code, state, session_id) from location, finalizes authentication via sdk.tokenExchange or provider-specific handler, then redirect to intended route (e.g., /profile).
  - Note: Keep this route unprotected so external providers and InAppBrowser flows can return.
  - Usage: useEffect(() => { const params = parseQuery(location.search); await sdk.tokenExchange(params); navigate('/profile'); }, []).

- src/pages/Profile.tsx

  - Purpose: Protected user profile page.
  - Behavior: Require authentication (Route guard or component-level check). Displays idTokenClaims and other user data from useStrivacity; optionally fetch server data using the session.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); provide logout button that calls logout(); protect route via guard or check isAuthenticated before render.

- src/pages/Revoke.tsx

  - Purpose: Revoke tokens or sessions (advanced session management).
  - Behavior: Calls SDK or backend revoke API to invalidate refresh tokens/sessions, surfaces success/error, then logs out or redirects.
  - Usage: await sdk.revoke(params) or call backend endpoint, then call logout() / navigate('/') on success; show confirmations.

- src/pages/Logout.tsx
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls sdk.logout(), clears client/native storage (Capacitor Preferences) and redirects to home or login. Implement as an effect that shows progress and navigates away.
  - Usage: useEffect(() => { await logout(); navigate('/'); }, []); ensure mobile/native clearing if using Capacitor storage.

Mobile-specific notes (applies to login/register/entry/callback flows)

- Use Capacitor.getPlatform() to choose between web redirect handlers and mobile InAppBrowser flows.
- For InAppBrowser flows, open the auth URL via InAppBrowser.openInWebView(...) and attach navigation listeners (InAppBrowser.addListener) to detect redirectUri navigation, then close the webview and forward params to sdk.tokenExchange or navigate to /callback?session_id=...
- Always keep the callback route unprotected so external providers / InAppBrowser can return to it.
- Use PluginListenerHandle cleanup to avoid leaks and handle user cancellation (browserClosed event).
