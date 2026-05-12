# `ui_locales` Locale Selection — IdP Comparison

OIDC `ui_locales` definition:

> End-User's preferred languages and scripts for the user interface, represented as a space-separated list of BCP47 [RFC5646] language tag values, ordered by preference. For instance, the value "fr-CA fr en" represents a preference for French as spoken in Canada, then French (without a region designation), followed by English (without a region designation). An error SHOULD NOT result if some or all of the requested locales are not supported by the OpenID Provider.

## How each IdP resolves the display language

### Auth0

`ui_locales` has the **highest priority** — it overrides the browser's `Accept-Language` header, provided the requested locale is enabled in the Auth0 Tenant Settings. If the locale is not enabled, Auth0 ignores the parameter and falls back to the browser header. The SDK (`@auth0/auth0-react`) never injects `ui_locales` automatically; it must be set explicitly via `authorizationParams`.

Resolution order:

1. `ui_locales` parameter (if locale is enabled in tenant settings)
2. `Accept-Language` header
3. Auth0 tenant default

### Okta

`ui_locales` is treated as a **high-priority hint**. If the locale is available in the active brand/theme, it takes precedence over the browser header. The SDK (`@okta/okta-auth-js`) does not inject it automatically. In the Sign-In Widget, the `language` option controls the client-side translation bundle, while `authParams.uiLocales` signals the locale to the Okta server.

Resolution order:

1. `ui_locales` parameter (if locale is available in brand/theme)
2. `Accept-Language` header
3. Okta org/brand default

### Ping Identity

`ui_locales` is treated as **explicit user intent** and takes priority over `Accept-Language`. In PingFederate, the lookup relies on Velocity Template property files (`filename_hu_HU.properties`); if the file is missing, it falls back to the browser header and then the server default. The SDK simply appends the parameter to the authorize URL.

Resolution order:

1. `ui_locales` parameter (if locale property file exists)
2. `Accept-Language` header
3. Server default locale

### ForgeRock / PingAM

Older versions (OpenAM) relied primarily on `Accept-Language`. Modern versions (PingAM) respect `ui_locales` as the **primary hint**, which drives the server-side localization bundles used in Authentication Tree callbacks. The SDK requires setting the locale both at initialization and in the OIDC authorize call.

Resolution order (PingAM):

1. `ui_locales` parameter
2. `Accept-Language` header
3. Server default locale

Resolution order (OpenAM / legacy):

1. `Accept-Language` header
2. `ui_locales` parameter
3. Server default locale

### Strivacity

Strivacity deviates from the standard: `ui_locales` has the **lowest priority**. The resolution order is:

1. `login_hint` JSON with `{"language": {"force": "hu-HU"}}` — overrides everything
2. Existing user session language — remembered from the last login
3. Browser `Accept-Language` header
4. `ui_locales` parameter — only used if none of the above are present

---

## Mid-Session Language Changes

### Auth0

Auth0’s Universal Login is essentially stateless regarding language changes mid-flow. To change the language, the user must typically re-initiate the /authorize request with a new `ui_locales` parameter. However, if using Custom Domains and New Universal Login with custom HTML, a client-side language switcher can be implemented. This switcher usually triggers a page reload with the updated locale appended to the URL, forcing Auth0 to re-render the template.

### Okta

In the Okta Sign-In Widget, mid-session language switching is handled on the client side. The widget can be re-rendered by calling render() with a new language configuration. If using the Okta-hosted login page, the language is locked upon the initial load based on the resolution order. Switching requires the application to restart the flow or the user to interact with a custom-built selector that refreshes the page context.

### Ping Identity

PingFederate and PingOne use server-side templates (Velocity). For a mid-session change, the UI typically includes a dropdown that submits a request back to the server. The server then updates the session’s locale state and re-renders the current step of the adapter/policy tree using the corresponding .properties file. It relies on a full page POST/GET cycle rather than a purely asynchronous update.

### ForgeRock / PingAM

Language switching within Authentication Trees is dynamic. A "Choice Collector" node or a custom scripted node can be inserted into the flow to allow users to select a language. Once selected, the node updates the sharedState, and subsequent callbacks (like attribute collection) are delivered by the server in the newly selected locale without breaking the current authentication session.

### Strivacity

Strivacity provides a highly dynamic, SPA-like experience in its hosted version. The language selector functions as follows:

- Asset Fetching: When a user selects a new language, the UI asynchronously fetches the specific language JSON files for that locale.
- State Re-initialization: The UI triggers a re-initialization (via an init call) with the backend.
- Content Refresh: The backend returns the current login screen's content and metadata localized to the new language, allowing the UI to update the interface immediately without a full browser reload or restarting the OIDC flow.

---

## Comparison Table

| IdP                    | `ui_locales` priority        | Beats `Accept-Language`?            | `login_hint` force support                 | Mid-session change mechanism                                                              | Language persists?                          |
| ---------------------- | ---------------------------- | ----------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Auth0**              | Highest                      | Yes (if locale is enabled)          | No                                         | Re-initiate `/authorize` with new `ui_locales`; custom HTML switcher triggers page reload | Session only (requires `persist: session`)  |
| **Okta**               | High                         | Yes (if locale is available)        | No                                         | Re-render Sign-In Widget with new `language`; hosted page requires restarting the flow    | Yes — stored in user profile                |
| **Ping Identity**      | High                         | Yes                                 | No                                         | Full page POST/GET cycle; server re-renders step from updated `.properties` file          | Only if `preferredLanguage` attr is updated |
| **ForgeRock / PingAM** | High (PingAM) / Low (OpenAM) | Yes (PingAM) / No (OpenAM)          | No                                         | Custom node updates `sharedState`; subsequent callbacks served in new locale              | Only if IDM `preferredLanguage` is updated  |
| **Strivacity**         | Lowest                       | No — `Accept-Language` already wins | **Yes** — `{"language": {"force": "..."}}` | Async locale fetch + `init` re-call; no page reload or flow restart needed                | Yes — session language stored server-side   |
