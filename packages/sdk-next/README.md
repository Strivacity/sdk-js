# @strivacity/sdk-next

> **The SDK supports React version 16 and above**

### Install

```bash
npm install @strivacity/sdk-next
```

### Usage

#### Wrap your app with Auth Provider:

```js
import { AuthProvider, useStrivacity } from '@strivacity/sdk-next';

const sdkOptions = {
	mode: 'redirect',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
};
const AppRoot = () => {
	return (
		<AuthProvider options={sdkOptions}>
			<App />
		</AuthProvider>
	);
};
```

#### How to use the SDK in your components:

```jsx
import { useEffect, useCallback } from 'react'
import { useStrivacity } from '@strivacity/sdk-next';

const { isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
const [name, setName] = useState('');
const onLogin = useCallback(() => {
	login();
},[]);
const onLogout = useCallback(() => {
	logout();
},[]);

useEffect(() => {
	setName(`${idTokenClaims?.given_name} ${idTokenClaims?.family_name}`);
}, [isAuthenticated, idTokenClaims]);

return (
	{isAuthenticated ? (<>
		<div>Welcome, {{ name }}!</div>
		<button onClick={onLogout()}>Logout</button>
	</>) : <>
		<div>Not logged in</div>
		<button onClick={onLogin()}>Log in</button>
	</>}
)
```

### API Documentation

#### `useStrivacity` hook

```typescript
useStrivacity<T extends PopupContext | RedirectContext>(): T;
```

You can choose between `PopupContext` or `RedirectContext` with the `mode` option when you configure the sdk options.

**Properties**

- **`loading: boolean`**: Indicates if the session is being loaded.
- **`isAuthenticated: boolean`**: Indicates whether the user is authenticated.
- **`idTokenClaims: IdTokenClaims | null`**: Claims from the ID token or null if not available.
- **`accessToken: string | null`**: The access token or null if not available.
- **`refreshToken: string | null`**: The refresh token or null if not available.
- **`accessTokenExpired: boolean`**: Indicates if the access token has expired.
- **`accessTokenExpirationDate: number | null`**: Expiration date of the access token or null if not set.

---

Type: `RedirectContext`
Represents the available methods for Redirect-based interactions.

- **`login(options?: LoginOptions): Promise<void>`**: Initiates the login process by redirecting the user to the identity provider.
  - `options` (optional): Configuration options for login.
- **`register(options?: RegisterOptions): Promise<void>`**: Registers a new user using a redirect flow.
  - `options` (optional): Configuration options for registration.
- **`refresh(): Promise<void>`**: Refreshes the user's session using a redirect flow.
- **`revoke(): Promise<void>`**: Revokes the current session tokens using a redirect flow.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs out the user by redirecting to the logout page.
  - `options` (optional): Configuration options for logout.
- **`handleCallback(url?: string): Promise<void>`**: Handles the callback after a redirect-based authentication or token exchange.
  - `url` (optional): The URL to handle for the callback.

---

Type: `PopupContext`
Represents the available methods for Popup-based interactions.

- **`login(options?: LoginOptions): Promise<void>`**: Initiates the login process using a popup window.
  - `options` (optional): Configuration options for login.
- **`register(options?: RegisterOptions): Promise<void>`**: Registers a new user using a popup flow.
  - `options` (optional): Configuration options for registration.
- **`refresh(): Promise<void>`**: Refreshes the user's session using a popup.
- **`revoke(): Promise<void>`**: Revokes the current session tokens using a popup flow.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs out the user using a popup window.
  - `options` (optional): Configuration options for logout.
- **`handleCallback(url?: string): Promise<void>`**: Handles the callback after a popup-based authentication or token exchange.
  - `url` (optional): The URL to handle for the callback.

### Links

[Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/next)
