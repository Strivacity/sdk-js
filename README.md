![JavaScript SDK](https://static.strivacity.com/images/javascript-sdk.png)

These SDKs allows you to integrate Strivacity’s policy-driven journeys into your brand’s JavaScript application. The SDK uses the OAuth 2.0 PKCE flow authenticate with Strivacity.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

# Client SDKs

- **[Core](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/web-component)
- **[Angular](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-angular)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular)
- **[Next.js](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-next)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/next)
- **[Nuxt](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-nuxt)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/nuxt)
- **[Remix](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-remix)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/remix)
- **[React](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-react)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/react)
- **[Vue.js](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-vue)** - [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/vue)

# Usage of Build and Serve Scripts

This repository provides npm scripts to build SDK packages and serve example applications. You can run these scripts from the project root using your preferred package manager (e.g., `pnpm`, `npm run`, or `yarn`).

## Build SDK Packages

To build a specific SDK package, use one of the following commands:

- `pnpm sdk:angular:build` – Build the Angular SDK
- `pnpm sdk:next:build` – Build the Next.js SDK
- `pnpm sdk:nuxt:build` – Build the Nuxt SDK
- `pnpm sdk:react:build` – Build the React SDK
- `pnpm sdk:remix:build` – Build the Remix SDK
- `pnpm sdk:vue:build` – Build the Vue SDK
- `pnpm sdk:core:build` – Build the Core SDK

> All SDK build scripts support the `--watch` flag for continuous build during development. For example: `pnpm sdk:react:build --watch`

## Serve Example Applications

Before serving any example application, you must create a `.env.local` file in the repository root. Copy the contents of `.env.local.example` and fill in the following values:

- `VITE_ISSUER`: your cluster domain
- `VITE_CLIENT_ID`: the client ID of your application
- `VITE_SCOPES`: the scopes you want to request

To start the development server for an example application, use one of the following commands:

- `pnpm app:angular:serve` – Serve the Angular example app
- `pnpm app:next:serve` – Serve the Next.js example app
- `pnpm app:nuxt:serve` – Serve the Nuxt example app
- `pnpm app:react:serve` – Serve the React example app
- `pnpm app:remix:serve` – Serve the Remix example app
- `pnpm app:vue:serve` – Serve the Vue example app
- `pnpm app:wc:serve` – Serve the Web Component example app

Replace `pnpm` with `npm run` or `yarn` if you use a different package manager.

# Contributing

Please see our [contributing guide](./CONTRIBUTING.md).
