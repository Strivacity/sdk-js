# @strivacity/sdk-core

### Install

```bash
npm install @strivacity/sdk-core
```

### Usage

```js
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'redirect', // or 'popup' or 'native'
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

await sdk.login();
```

### API Documentation

#### `initFlow(options: SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }): PopupFlow | RedirectFlow | NativeFlow`

The `initFlow` function initializes and returns an instance of either `PopupFlow`, `RedirectFlow`, or `NativeFlow`, based on the specified `mode`.

**Parameters:**

- `options`: An object containing configuration options for the SDK.

  **Type:** `SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }`

  **Properties:**

  - `issuer` (string): The issuer URL of the OpenID Provider.
  - `clientId` (string): The client identifier for the application.
  - `redirectUri` (string): The URI to redirect to after authentication.
  - `scopes` (Array<string>): The scopes to request during authentication.
  - `responseType` (ResponseType): The response type requested from the OpenID Provider.
  - `responseMode` (ResponseMode): The response mode to use.
  - `storageTokenName` (string): The name of the token in storage.
  - `storage` (SDKStorageType): A custom storage implementation.

  **Mode:**

  - `popup`: Uses a popup window for authentication. Returns an instance of `PopupFlow`.
  - `redirect`: Uses a full-page redirect for authentication. Returns an instance of `RedirectFlow`.
  - `native`: Uses a native flow for authentication. Returns an instance of `NativeFlow`.

### Links

[Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/web-component)
