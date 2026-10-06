# Native mode (`mode: 'native'`)

Your app renders every login screen with its own components. Instead of HTML, the identity provider returns a JSON **screen state** (`NativeFlowState`): a `screen` name, one or more `forms` that each hold a flat list of `widgets`, a `layout` tree that arranges them, and validation `messages`. The app collects input and submits a form. The IdP answers with the next screen, and this repeats until the journey completes. The user never leaves your page and sees only your markup.

**Choose it when:** you need full control of the login UI (design system, custom per-screen markup, animations), and you accept maintaining a renderer for every widget type the journeys can produce.

**Choose another mode if:** you want login screens without writing UI (use `redirect` or `popup`), or you want an inline login with Strivacity's own UI (use `embedded`). Native mode always needs a working **fallback to the hosted journey** for screens or widgets you have not implemented.

Native journey docs: https://docs.strivacity.com/reference/native-journey

## Admin Console requirement

- Client type: **OIDC using the Journey Flow API**. A "no-code components" client does not work with `native`.
- Register `redirectUri` as an allowed redirect URI. The SDK rejects a finalize response whose redirect does not start with `redirectUri` (`ProtocolError: Invalid redirect URI`). With server-managed sessions the browser is actually sent there.
- Set the client's **Entry URL** to your app's `/entry` route (for example `https://app.example.com/entry`) for password-reset, verification and other externally-initiated flows.
- For passkey/WebAuthn widgets, add your app origin to the trusted origins. See https://docs.strivacity.com/reference/sdks#client-configuration

## Flow lifecycle (core `NativeFlow`)

| Method                       | Returns                            | What it does                                                                                                                                                                                                                                         |
| :--------------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startSession(params?)`      | `Promise<NativeFlowState \| void>` | Starts the authorization request and loads the first screen. With `params.sessionId` it resumes an existing flow (entry links) instead. Resolves `void` if the IdP immediately returned a `code`; the session is then completed without any screens. |
| `submitForm(formId?, body?)` | `Promise<NativeFlowState>`         | POSTs one form's values and returns the next screen. **If the response has `finalizeUrl`, it finalizes automatically.** Client-managed: tokens are exchanged and stored. Server-managed: `window.location.href` is set to `redirectUri?code=...`.    |
| `finalizeSession(url)`       | `Promise<void>`                    | Low-level finalize step. `submitForm()` already calls it, so do not call it again with the same `finalizeUrl`.                                                                                                                                       |
| `entry(url?)`                | `Promise<EntryResponse>`           | On the `/entry` page: resolves `{ session_id, short_app_id, language }` from the current URL.                                                                                                                                                        |

`login()` / `register()` on the native flow are deprecated wrappers. Use `startSession({ prompt: 'create' })` for registration.

`NativeParams` (for `startSession`): `ExtraRequestArgs` (`loginHint`, `acrValues`, `uiLocales`, `audiences`, `prompt`) plus `sessionId?: string | null` and `language?: string | null`.

In the framework packages you normally do not call these yourself. `useNativeLogin()` calls `startSession()` on mount and wraps `submitForm()`.

Every framework's `useNativeLogin()` (and Angular's `StrivacityNativeLoginService`) is a thin binding over `createNativeLoginController(sdk, options)` from `@strivacity/sdk-core/utils`. For a framework without a Strivacity package, use the controller directly: `subscribe(listener)` delivers immutable `{ loading, forms, messages, state }` snapshots, `start()` runs `init()` and `startSession(options.params)`, and `setOptions(options)` swaps the callbacks. The methods are the same as the `LoginContext` methods below.

## Screen state (`NativeFlowState`)

```ts
type NativeFlowState = {
	hostedUrl?: string; // hosted-journey URL for this step: the fallback target
	finalizeUrl?: string; // journey complete (handled by submitForm automatically)
	screen?: string; // step id, e.g. 'identification', 'password', 'registration'
	branding?: BrandingData; // logoUrl, brandName, copyright, privacyPolicyUrl, siteTermsUrl
	forms?: Array<{ id: string; type: 'form'; widgets: AnyWidget[] }>;
	layout?: LayoutWidget; // { type: 'vertical' | 'horizontal'; items: Array<{ type: 'widget'; formId; widgetId } | LayoutWidget> }
	messages?: Record<string, Record<string, { type: string; text: string }>> & { global?: { type: string; text: string } };
};
```

- Each widget has an `id` and a `type`. A form is submitted by `formId`, and its body is `{ [widgetId]: value }`. Widget ids containing dots are unflattened (`'a.b'` becomes `{ a: { b } }`) by the hook before sending.
- `messages[formId][widgetId].text` is the validation message for a field. `messages.global` is a screen-level message (the hook passes it to `onGlobalMessage`).
- Render in `layout` order: walk `layout.items` recursively and look up each `{ formId, widgetId }` in `forms`.

### Widget types (`WidgetType`)

| `type`           | Key config fields                                                                                                                     | Value to submit (`setFormValue`)                              |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------ |
| `layout`         | (layout node, not in `forms`) `type: 'vertical' \| 'horizontal'`, `items`                                                             | none                                                          |
| `static`         | `value`, `render.type: 'html' \| 'text'`                                                                                              | none                                                          |
| `input`          | `label`, `value`, `readonly`, `autocomplete`, `inputmode`, `render.autocompleteHint`, `validator{required,minLength,maxLength,regex}` | `string`                                                      |
| `password`       | `label`, `qualityIndicator`, `validator{minLength,maxLength,mustContain,...}`                                                         | `string`                                                      |
| `passcode`       | `label`, `validator.length`                                                                                                           | `string`                                                      |
| `phone`          | `label`, `value`, `readonly`, `validator.required`                                                                                    | `string`                                                      |
| `date`           | `label`, `value`, `render.type: 'native' \| 'fieldSet'`, `validator{notBefore,notAfter,required}`                                     | ISO date string (`YYYY-MM-DD`)                                |
| `checkbox`       | `label`, `value`, `render.type: 'checkboxHidden' \| 'checkboxShown'`, `render.labelType: 'text' \| 'html'`                            | `boolean`                                                     |
| `select`         | `options` (items or `group`s), `render.type: 'dropdown' \| 'radio'`, `value`                                                          | `string`                                                      |
| `multiSelect`    | `options`, `value`, `validator{minSelectable,maxSelectable}`                                                                          | `string[]`                                                    |
| `submit`         | `label`, `render.type: 'button' \| 'link'`, `render.textColor/bgColor/hint.variant`                                                   | none, calls `submitForm(formId)`                              |
| `close`          | `label`, `render.type: 'button' \| 'link'`                                                                                            | none, calls `triggerClose()`                                  |
| `passkeyLogin`   | `label`, `assertionOptions`                                                                                                           | result of `assertWebAuthnCredential(config.assertionOptions)` |
| `passkeyEnroll`  | `label`, `enrollOptions`                                                                                                              | result of `createWebAuthnCredential(config.enrollOptions)`    |
| `webauthnLogin`  | `label`, `authenticatorType: 'deviceBiometrics' \| 'securityKey'`, `assertionOptions`                                                 | result of `assertWebAuthnCredential(config.assertionOptions)` |
| `webauthnEnroll` | `label`, `authenticatorType`, `enrollOptions`                                                                                         | result of `createWebAuthnCredential(config.enrollOptions)`    |

Widget config types are exported by name (`InputWidget`, `PasswordWidget`, `SubmitWidget`, `PasskeyLoginWidget`, `LayoutWidget`, `Widget`, `FormWidget`, `AnyWidget`, `WidgetType`, `NativeFlowState`, ...) from the framework package. `WidgetTypeList` is a type-level declaration only, so do not import it as a runtime value. Build your own `Record<WidgetType, Component>` map instead.

`static` with `render.type: 'html'` and `checkbox` with `labelType: 'html'` carry HTML from your tenant configuration. Render it as HTML only if you trust that content.

### Passkeys / WebAuthn

`assertWebAuthnCredential` and `createWebAuthnCredential` are exported from the framework package (from `@strivacity/sdk-core/utils`). Call them from a click handler and submit the JSON result as the widget's value:

```ts
const response = await assertWebAuthnCredential(config.assertionOptions); // or createWebAuthnCredential(config.enrollOptions)

setFormValue(formId, config.id, response);
await submitForm(formId); // includes the value just set, in every framework
```

## Fallback to the hosted journey (`hostedUrl`)

You must handle this. Two triggers:

1. **SDK-detected:** `submitForm()` / `startSession()` throw `FallbackError` (with `error.url: URL` = `hostedUrl`) when the IdP answers 4xx with a `hostedUrl` and no `messages`, or returns a `hostedUrl` with no `forms`, `messages` or `finalizeUrl`. `useNativeLogin` catches it and calls `onFallback(error)`.
2. **Renderer-detected:** when your renderer meets a widget type or layout item it cannot render, call `triggerFallback('reason')`. It calls `onFallback(new FallbackError(new URL(state.hostedUrl)))`. If the current state has no `hostedUrl`, it throws `Error('No hosted URL provided')`.

In both cases `onFallback` must send the browser to the hosted journey: `window.location.href = error.url.toString()`.

Other errors reach `onError`. These include `SessionExpiredError` (HTTP 403 from the flow API, for example when the session expired), network errors (`NetworkError`), server errors (`ServerError`) and `OidcError`. Typically, show an error and offer to restart the login.

## Required routes

| Route                      | Required?                          | What it does                                                                                                                                                                                                            |
| :------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login / Register           | yes                                | Calls `useNativeLogin({ params })` and renders `state`. Register = `params.prompt: 'create'`. Passes `session_id` and `language` from the query string as `params.sessionId` / `params.language` to resume entry flows. |
| Entry (`/entry`)           | yes (for reset/verification links) | Calls `entry()` and redirects to `/login?${new URLSearchParams(result)}`.                                                                                                                                               |
| Callback (= `redirectUri`) | server-managed sessions only       | After finalize, the SDK navigates here with `?code=...`. Forward to the server callback (`/auth/callback?${searchParams}`). With client-managed sessions it is not navigated to.                                        |

## The hook API (React / Next.js / Vue)

`useNativeLogin(options)` starts the session on mount and returns a `LoginContext`. `useNativeLoginContext()` returns the same context from any descendant component (for widget components).

| `UseNativeLoginOptions` | Called when                                                                                                                                                            |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`                | `NativeParams` passed to `startSession()` on mount.                                                                                                                    |
| `onLogin(session)`      | A valid client-side session exists after a response. **Only with client-managed sessions.** With `serverSessionUri` the browser is navigated to `redirectUri` instead. |
| `onFallback(error)`     | `FallbackError` from the SDK or `triggerFallback()`. Redirect to `error.url`.                                                                                          |
| `onError(error)`        | Any other error from init, start or submit.                                                                                                                            |
| `onClose()`             | `triggerClose()` was called (the `close` widget).                                                                                                                      |
| `onGlobalMessage(msg)`  | The response contained `messages.global`.                                                                                                                              |

| `LoginContext` member                   | Notes                                                                     |
| :-------------------------------------- | :------------------------------------------------------------------------ |
| `loading`                               | `true` while starting or submitting. Disable inputs and buttons.          |
| `state`                                 | Current `NativeFlowState` (partial).                                      |
| `forms`                                 | Collected values: `forms[formId][widgetId]`. Reset when `screen` changes. |
| `messages`                              | `messages[formId][widgetId]`. Reset when `screen` changes.                |
| `setFormValue(formId, widgetId, value)` | `''` is stored as `null`.                                                 |
| `submitForm(formId, customBody?)`       | Sends `customBody` or the current `forms[formId]` (unflattened).          |
| `setMessage(formId, widgetId, msg)`     | Set a client-side validation message.                                     |
| `triggerFallback(message?)`             | See Fallback.                                                             |
| `triggerClose()`                        | Calls `onClose`.                                                          |

If `startSession()` resolves without a state (the IdP returned a `code` immediately, for example from an existing SSO session), the hook does not call `onLogin` and `loading` stays `true`. Check `isAuthenticated` from `useStrivacity()` if this case matters for you.

In React/Next.js the members are plain values. In Vue `loading`, `state`, `forms` and `messages` are `Ref`s (use `.value` in script; in templates access them through the returned object, for example `ctx.state.value.screen`). Vue's `useNativeLoginContext()` uses `inject`, so it works only in components rendered **below** the one that called `useNativeLogin()`. React's context is a module-level store: mount only one `useNativeLogin()` at a time.

## Framework snippets

### React (`@strivacity/sdk-react`)

```tsx
// NativeLogin.tsx
import type { ComponentType } from 'react';
import type { LayoutWidget, WidgetType } from '@strivacity/sdk-react';
import { useNativeLogin, useNativeLoginContext } from '@strivacity/sdk-react';
import { useNavigate } from 'react-router';
import { InputWidget, SubmitWidget, PasskeyLoginWidget } from './widgets'; // your components

// Add a component for every widget type your journeys use; anything missing falls back to hosted
const widgets: Partial<Record<WidgetType, ComponentType<any>>> = {
	input: InputWidget,
	submit: SubmitWidget,
	passkeyLogin: PasskeyLoginWidget,
};

function Items({ items = [] }: { items?: LayoutWidget['items'] }) {
	const { state, triggerFallback } = useNativeLoginContext();

	return (
		<>
			{items.map((item, index) => {
				if (item.type === 'widget') {
					const form = state.forms?.find((f) => f.id === item.formId);
					const widget = form?.widgets.find((w) => w.id === item.widgetId);
					const Component = widget && widgets[widget.type];

					if (!form || !widget || !Component) {
						triggerFallback(`Cannot render ${item.formId}.${item.widgetId}`);
						return null;
					}

					return <Component key={`${form.id}.${widget.id}`} formId={form.id} config={widget} />;
				}

				return (
					<div key={index} data-layout={item.type}>
						<Items items={item.items} />
					</div>
				);
			})}
		</>
	);
}

export default function NativeLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const navigate = useNavigate();
	const searchParams = new URLSearchParams(window.location.search);

	const ctx = useNativeLogin({
		params: {
			...(flowType === 'register' ? { prompt: 'create' } : {}),
			sessionId: searchParams.get('session_id'), // resume entry flows
			language: searchParams.get('language'),
		},
		onLogin: async () => await navigate('/profile'),
		onClose: () => window.location.reload(),
		onError: async (error) => await navigate(`/error?error=${encodeURIComponent(error.message)}`),
		onFallback: (error) => {
			window.location.href = error.url.toString();
		},
		onGlobalMessage: (message) => alert(message.text),
	});

	if (ctx.loading && !ctx.state.screen) {
		return <p>Loading...</p>;
	}

	const firstFormId = (ctx.state.layout?.items?.[0] as { formId?: string } | undefined)?.formId;

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (firstFormId) void ctx.submitForm(firstFormId);
			}}
		>
			<Items items={ctx.state.layout?.items} />
		</form>
	);
}
```

```tsx
// widgets/InputWidget.tsx
import { useEffect } from 'react';
import type { InputWidget as InputWidgetConfig } from '@strivacity/sdk-react';
import { useNativeLoginContext } from '@strivacity/sdk-react';

export function InputWidget({ formId, config }: { formId: string; config: InputWidgetConfig }) {
	const { loading, messages, setFormValue } = useNativeLoginContext();
	const error = messages[formId]?.[config.id]?.text;

	useEffect(() => {
		// Prefilled values must be put into the form state, or they are not submitted
		if (config.value) setFormValue(formId, config.id, config.value);
	}, []);

	return (
		<div>
			{config.label && <label htmlFor={config.id}>{config.label}</label>}
			<input
				id={config.id}
				defaultValue={config.value}
				readOnly={loading || config.readonly}
				required={config.validator?.required}
				autoComplete={config.autocomplete ?? 'on'}
				onChange={(event) => setFormValue(formId, config.id, event.target.value)}
			/>
			{error && <small>{error}</small>}
		</div>
	);
}
```

```tsx
// widgets/SubmitWidget.tsx and widgets/PasskeyLoginWidget.tsx
import type { PasskeyLoginWidget as PasskeyConfig, SubmitWidget as SubmitConfig } from '@strivacity/sdk-react';
import { assertWebAuthnCredential, useNativeLoginContext } from '@strivacity/sdk-react';

export function SubmitWidget({ formId, config }: { formId: string; config: SubmitConfig }) {
	const { loading, submitForm } = useNativeLoginContext();

	return (
		<button type="button" disabled={loading} onClick={() => void submitForm(formId)}>
			{config.label}
		</button>
	);
}

export function PasskeyLoginWidget({ formId, config }: { formId: string; config: PasskeyConfig }) {
	const { loading, setFormValue, submitForm } = useNativeLoginContext();

	const onClick = async () => {
		const response = await assertWebAuthnCredential(config.assertionOptions);
		setFormValue(formId, config.id, response);
		await submitForm(formId); // sees the value set above, without waiting for a re-render
	};

	return (
		<button type="button" disabled={loading} onClick={() => void onClick()}>
			{config.label}
		</button>
	);
}
```

`SubmitWidget` calls `submitForm(formId)` directly because a screen can contain several forms (for example `password` and `reset`) and each button submits its own form. `submitForm(formId)` sends the current values, including a `setFormValue()` call made earlier in the same handler (the React and Preact hooks keep the values in a ref, so they do not wait for a re-render). Pass `customBody` only to send something other than the collected values. It is sent as is, so use `unflattenObject` (exported by the package) if it has dotted widget ids.

Custom per-screen markup: branch on `ctx.state.screen` (for example `'password'`), find widgets by id in `ctx.state.forms`, and render your own layout. Keep the generic renderer for every other screen.

Entry page: `const { loading, entry } = useStrivacity<NativeFlow>()`; once `!loading`, `entry().then((params) => { const url = new URL('/login', window.location.origin); url.search = new URLSearchParams(params).toString(); window.location.href = url.toString(); })`.

### Next.js (`@strivacity/sdk-next`, App Router)

Identical to React, with these differences:

- Put `'use client';` at the top of the native login component and of every widget component.
- Import everything (`useNativeLogin`, `useNativeLoginContext`, `assertWebAuthnCredential`, `createWebAuthnCredential`, widget types, `NativeFlow`) from `@strivacity/sdk-next/client`.
- Navigate with `window.location.href = '/profile'` or `useRouter()` from `next/navigation`.
- Next.js apps default to server-managed sessions (`serverSessionUri: '/auth/login'`). Then `onLogin` is **not** called. After the last form, the SDK navigates to `redirectUri`, and the `app/callback/route.ts` route handler must redirect to `/auth/callback` with the same query string. The Server SDK then redirects to `postLoginRedirectUri`.

### Vue (`@strivacity/sdk-vue`)

```vue
<!-- NativeLogin.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useNativeLogin } from '@strivacity/sdk-vue';
import NativeLoginItems from './NativeLoginItems.vue';

const props = defineProps<{ flowType: 'login' | 'register' }>();
const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

const ctx = useNativeLogin({
	params: {
		...(props.flowType === 'register' ? { prompt: 'create' } : {}),
		sessionId: searchParams.get('session_id'),
		language: searchParams.get('language'),
	},
	onLogin: () => void router.push('/profile'), // client-managed sessions only
	onClose: () => window.location.reload(),
	onError: (error) => void router.push(`/error?error=${encodeURIComponent(error.message)}`),
	onFallback: (error) => {
		window.location.href = error.url.toString();
	},
	onGlobalMessage: (message) => alert(message.text),
});

function firstFormId() {
	return (ctx.state.value.layout?.items?.[0] as { formId?: string } | undefined)?.formId;
}
</script>

<template>
	<section v-if="!ctx.state.value.screen">Loading...</section>
	<form v-else @submit.prevent="firstFormId() && ctx.submitForm(firstFormId()!)">
		<NativeLoginItems :items="ctx.state.value.layout?.items" />
	</form>
</template>
```

```vue
<!-- NativeLoginItems.vue: recursive layout walker (a descendant, so inject works) -->
<script setup lang="ts">
import type { Component } from 'vue';
import type { LayoutWidget, WidgetType } from '@strivacity/sdk-vue';
import { useNativeLoginContext } from '@strivacity/sdk-vue';
import InputWidget from './widgets/InputWidget.vue';
import SubmitWidget from './widgets/SubmitWidget.vue';

defineOptions({ name: 'NativeLoginItems' });
defineProps<{ items?: LayoutWidget['items'] }>();

const { state, triggerFallback } = useNativeLoginContext();
const widgets: Partial<Record<WidgetType, Component>> = { input: InputWidget, submit: SubmitWidget };

function resolve(formId: string, widgetId: string) {
	const form = state.value.forms?.find((f) => f.id === formId);
	const widget = form?.widgets.find((w) => w.id === widgetId);
	const component = widget && widgets[widget.type];

	if (!widget || !component) {
		triggerFallback(`Cannot render ${formId}.${widgetId}`);
		return null;
	}

	return { component, widget };
}
</script>

<template>
	<template v-for="(item, index) in items ?? []" :key="index">
		<template v-if="item.type === 'widget'">
			<component
				v-if="resolve(item.formId, item.widgetId)"
				:is="resolve(item.formId, item.widgetId)!.component"
				:formId="item.formId"
				:config="resolve(item.formId, item.widgetId)!.widget"
			/>
		</template>
		<div v-else :data-layout="item.type">
			<NativeLoginItems :items="item.items" />
		</div>
	</template>
</template>
```

```vue
<!-- widgets/InputWidget.vue -->
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { type InputWidget, useNativeLoginContext } from '@strivacity/sdk-vue';

const props = defineProps<{ formId: string; config: InputWidget }>();
const { loading, messages, setFormValue } = useNativeLoginContext();
const error = computed(() => messages.value[props.formId]?.[props.config.id]?.text);

onMounted(() => {
	// Prefilled values must be put into the form state, or they are not submitted
	if (props.config.value) setFormValue(props.formId, props.config.id, props.config.value);
});
</script>

<template>
	<div>
		<label v-if="config.label" :for="config.id">{{ config.label }}</label>
		<input
			:id="config.id"
			:value="config.value"
			:readonly="loading || config.readonly"
			:required="config.validator?.required"
			@input="setFormValue(formId, config.id, ($event.target as HTMLInputElement).value)"
		/>
		<small v-if="error">{{ error }}</small>
	</div>
</template>
```

A submit widget calls `submitForm(formId)` from `useNativeLoginContext()`. Passkey and WebAuthn widgets follow the snippet in "Passkeys / WebAuthn". The entry page is `const params = await useStrivacity<NativeFlow>().entry()` followed by the redirect to `/login?${new URLSearchParams(params)}`.

Full reference renderers with all 16 widget types: https://github.com/Strivacity/sdk-js/tree/main/apps/react/src/components/auth/native and https://github.com/Strivacity/sdk-js/tree/main/apps/vue/src/components/auth/native

## Common mistakes

| Symptom / mistake                                                       | Cause                                                                                                              | Fix                                                                                                                                 |
| :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| User stuck on a blank or half-rendered screen                           | No `onFallback`, or the renderer silently skips unknown widget types.                                              | Implement `onFallback` (`window.location.href = error.url.toString()`) and call `triggerFallback()` for anything you cannot render. |
| `Error: No hosted URL provided`                                         | `triggerFallback()` called before any state with `hostedUrl` arrived.                                              | Only render (and fall back) once `state.screen` is set.                                                                             |
| Errors right after switching to `native`                                | Client type is "OIDC using no-code components".                                                                    | Use an "OIDC using the Journey Flow API" client.                                                                                    |
| Finalize fails / "Invalid redirect URI"                                 | `redirectUri` not registered, or `finalizeSession()` called again after `submitForm()` already finalized.          | Register the exact `redirectUri`; never call `finalizeSession()` yourself after `submitForm()`.                                     |
| `onLogin` never fires (BFF / Next.js default)                           | With `serverSessionUri` the SDK navigates to `redirectUri` instead.                                                | Add the callback page that forwards to `/auth/callback`; let the server redirect to the protected page.                             |
| Reset/verification links start a new login                              | No `/entry` route or Entry URL, or `session_id` / `language` not passed as `params.sessionId` / `params.language`. | Add the entry page and read the query params on the login page.                                                                     |
| Submitting the wrong form on multi-form screens                         | One global submit handler always uses the first form.                                                              | Let each `submit` widget call `submitForm(its formId)`.                                                                             |
| `useNativeLoginContext` throws "Missing SDK native login context" (Vue) | Called in the same component as `useNativeLogin()` or outside its subtree.                                         | Use it only in child components.                                                                                                    |
| Passkey prompt does not appear                                          | WebAuthn call not triggered by a user click, or origin not trusted in the Admin Console.                           | Call `assertWebAuthnCredential` / `createWebAuthnCredential` from a click handler; configure trusted origins.                       |
| `SessionExpiredError` in `onError`                                      | Flow session expired (HTTP 403).                                                                                   | Restart: reload the login page without `session_id`.                                                                                |
| Importing `WidgetTypeList` fails at runtime                             | It is declared only as a type.                                                                                     | Use the `WidgetType` type and your own component map.                                                                               |
