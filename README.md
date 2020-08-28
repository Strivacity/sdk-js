# @strivacity/sdk-js

Strivacity SDK for JavaScript based Applications with TypeScript support.

## Table of Contents

- [Getting Started](#getting-started)
- [License](#license)

## Getting Started

### Overview

This SDK is built as an [npm module](https://docs.npmjs.com/creating-node-js-modules).

You can also build this module directly. The build requires the [yarn](https://yarnpkg.com/) tool.

### Install dependencies

```sh
cd <project-root-directory>
yarn install
```

### Build the module

```sh
yarn build
```

Output of the build will be placed in the "dist" folder.

### Creating the client

Create an `StrivacityClient` instance before rendering or initializing your application. You should only have one instance of the client.

#### Import as [UMD](https://github.com/umdjs/umd)
```html
<head>
    <script src="../dist/index.umd.js"></script>
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
	import { StrivacityClient } from '../dist/index.esm.js';

	const client = new StrivacityClient({
		timeout: 50000,
		url: <STRIVACITY-URL>,
	});
</script>
</body>
```

### Usage

#### Anonymous identities


##### `client.anonymousIdentity.createIdentity`
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

###### Example:
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


##### `client.anonymousIdentity.checkIdentityById`
Check an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| id | ID of anonymous identity | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


##### `client.anonymousIdentity.getIdentityById`
Get an anonymous identity and return as a Promise.

**Auth required**: Yes

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| id | ID of anonymous identity | string | - | Yes
| session | Session | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


###### Example:
```js
client.anonymousIdentity.getIdentityById('testId', 'session')
    .then((response) => console.log('success', response))
    .catch((error) => console.log('error', error));
```


##### `client.anonymousIdentity.deleteIdentityById`
Delete an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| id | ID of anonymous identity | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


---


#### Anonymous identity's consents


##### `client.anonymousIdentity.consent.getConsents`
Get all consents of an anonymous identity and return as a Promise.

**Auth required**: Yes

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| session | Session | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |

###### Example:
```js
client.anonymousIdentity.consent.getConsents('testId', 'session')
    .then((response) => console.log('success', response))
    .catch((error) => console.log('error', error));
```


##### `client.anonymousIdentity.consent.createConsent`
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


##### `client.anonymousIdentity.consent.checkConsentById`
Check a consent of an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| id | ID of consent | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |


##### `client.anonymousIdentity.consent.getConsentById`
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


##### `client.anonymousIdentity.consent.deleteConsentById`
Delete a consent of an anonymous identity and return as a Promise.

**Auth required**: No

Parameters

Name | Description | Type | Default Value | Required
--- | --- | --- | --- | ---
| identityId | ID of anonymous identity | string | - | Yes
| id | ID of consent | string | - | Yes
| options | Fetch API options | RequestInit | `{}` | |
| timeout | Overwrite the default timeout | number | 30000 | |

## License

This project is licensed under the MIT license. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/master/LICENSE) file for more info.
