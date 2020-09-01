# @strivacity/sdk-js

Strivacity SDK for JavaScript based Applications with TypeScript support.

## Table of Contents

- [Usage](#usage)
  - [Package Manager](#package-manager)
  - [Browser](#browser)
  - [Legacy Browser](#legacy-browser)
- [Build manually](#build-manually)
- [API](#API)
  - [Anonymous identities](#anonymous-identities)
  - [Anonymous identity's consents](#anonymous-identitys-consents)
- [Frequently Asked Questions](#frequently-asked-questions)
- [License](#license)

## Usage

### Package manager

Install `@strivacity/sdk-js` package with the following command:

```
yarn add @strivacity/sdk-js # npm install @strivacity/sdk-js --save
```

Create a `StrivacityClient` instance to initialize your application.

**Note:** You should only have one instance of the client.

```js
import createStrivacityClient from '@strivacity/sdk-js';

const client = await createStrivacityClient({
	timeout: 50000,
	url: '<STRIVACITY-URL>',
});
```

### Browser

Supported browsers:
* Google Chrome 42+
* Microsoft Edge 14+
* Mozilla Firefox 39+
* Safari 10.1+

#### Import as [UMD](https://github.com/umdjs/umd)
```html
<head>
	<script src="https://unpkg.com/browse/@strivacity/sdk-js/dist/strivacity-sdk.umd.js"></script>
</head>

<script>
	(async function() {
		const client = await createStrivacityClient({
			timeout: 50000,
			url: <STRIVACITY-URL>,
		});
	})();
</script>
```

#### Import as [ESM](https://nodejs.org/api/esm.html)
```html
<body>
<script type="module">
	import { StrivacityClient } from 'https://unpkg.com/browse/@strivacity/sdk-js/dist/strivacity-sdk.esm.js';

	const client = new StrivacityClient({
		timeout: 50000,
		url: <STRIVACITY-URL>,
	});
</script>
</body>
```

### Legacy Browser

Supported browsers:
* Google Chrome 42+
* Microsoft Edge 12+
* Mozilla Firefox 39+
* Safari 9+
* Internet Explorer 11

If you want to use this sdk with legacy browsers you need to add the following polyfills:

* [Promise polyfill](https://www.npmjs.com/package/promise-polyfill)
* [AbortController polyfill](https://www.npmjs.com/package/abort-controller)
* [fetch() polyfill](https://www.npmjs.com/package/whatwg-fetch)

#### Using with bundler tools

Install the following dependencies:

```sh
yarn add -D promise-polyfill whatwg-fetch abort-controller # npm install promise-polyfill whatwg-fetch abort-controller --dev
```

Import to your main entry file the installed packages:

```js
import 'promise-polyfill/src/polyfill';
import 'abort-controller/polyfill';
import 'whatwg-fetch';
```

#### Using in old browsers via CDN

See the [legacy example](examples/legacy.html) file.

#### Using in old browsers via self hosted

Download the following files and copy to your website directory:

* [https://unpkg.com/promise-polyfill@8.1.3/dist/polyfill.min.js](https://unpkg.com/promise-polyfill@8.1.3/dist/polyfill.min.js)
* [https://unpkg.com/whatwg-fetch@3.4.0/dist/fetch.umd.js](https://unpkg.com/whatwg-fetch@3.4.0/dist/fetch.umd.js)
* [https://unpkg.com/abort-controller@3.0.0/dist/abort-controller.umd.js](https://unpkg.com/abort-controller@3.0.0/dist/abort-controller.umd.js)
* [https://unpkg.com/@strivacity/sdk-js/dist/strivacity-sdk.legacy.js](https://unpkg.com/@strivacity/sdk-js/dist/strivacity-sdk.legacy.js)

Add to your html file with `<script>` tags.

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<script src="./polyfill.min.js"></script>
	<script src="./fetch.umd.js"></script>
	<script src="./abort-controller.umd.js"></script>
	<script src="./strivacity-sdk.legacy.js"></script>
</head>
<body>
	...
</body>
</html>
```

## Build manually

Build the package with the following commands:

```sh
git clone https://github.com/Strivacity/sdk-js.git # clone this repository
cd sdk-js
yarn install # npm install
yarn run build # npm run build
```

Output of the build will be placed in the `dist` folder.

## API

### Anonymous identities

#### `client.anonymousIdentity.createIdentity`
Create an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| body | _Attribute_ | _Attribute_ | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |

Example body (Attribute)
```
{
  "attributes": {
    "familyName": "string",
    "givenName": "string",
    "email": "string"
  }
}
```

Success Response
```
{
  "id": "string",
  "createdAt": "string",
  "attributes": {
    "familyName": "string",
    "givenName": "string",
    "email": "string"
  }
}
```

##### Example:
```js
const attributes = {
  attributes: {
    familyName: "Snow",
    givenName: "John",
    email: "email@email.com"
  }
};

client.anonymousIdentity.createIdentity(attributes)
    .then((response) => console.log('success', response))
    .catch((error) => console.log('error', error));
```


#### `client.anonymousIdentity.checkIdentityById`
Check an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| id | ID of anonymous identity | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


#### `client.anonymousIdentity.getIdentityById`
Get an anonymous identity and return as a Promise.

**Auth required**: Yes

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| id | ID of anonymous identity | string | - | Yes
| session | Session | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


##### Example:
```js
client.anonymousIdentity.getIdentityById('testId', 'session')
    .then((response) => console.log('success', response))
    .catch((error) => console.log('error', error));
```


#### `client.anonymousIdentity.deleteIdentityById`
Delete an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| id | ID of anonymous identity | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


---


### Anonymous identity's consents


#### `client.anonymousIdentity.consent.getConsents`
Get all consents of an anonymous identity and return as a Promise.

**Auth required**: Yes

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| session | Session | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |

##### Example:
```js
client.anonymousIdentity.consent.getConsents('testId', 'session')
    .then((response) => console.log('success', response))
    .catch((error) => console.log('error', error));
```


#### `client.anonymousIdentity.consent.createConsent`
Create a consent of an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| body | _Attribute_ | _Attribute_ | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |

Example body (Attribute)
```
{
  "format": "iab",
  "iab": {
    "receipt": "string"
  }
}
```

Success Response
```
{
  "id": "string",
  "createdAt": "string",
  "format": "iab",
  "iab": {
    "receipt": "string"
  }
}
```


#### `client.anonymousIdentity.consent.checkConsentById`
Check a consent of an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| id | ID of consent | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


#### `client.anonymousIdentity.consent.getConsentById`
Get a consent of an anonymous identity and return as a Promise.

**Auth required**: Yes

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| id | ID of consent | string | - | Yes
| session | Session | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


#### `client.anonymousIdentity.consent.deleteConsentById`
Delete a consent of an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| id | ID of consent | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |

## Frequently Asked Questions

### Why I need to use polyfills when I want to support old browsers?

A polyfill is code that defines a new object or method in browsers that don’t support that object or method.
We don't want to include the listed polyfills into our bundled file, because if your website already contains one of it, you'll download that polyfill twice.

## License

This project is licensed under the MIT license. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/master/LICENSE) file for more info.
