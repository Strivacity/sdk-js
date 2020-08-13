## Environment

- Node >= 12.x
- yarn >= 1.22.x

## Install dependencies
```
yarn
```

## Building

```
yarn run build
```

## Tests

```
yarn run test
```

## Linter

```
yarn run lint

// with autofixing
yarn run lint --fix
```

### Example project
You can find an example project written in native JavaScript under **example** folder.

Build steps

1. Build the project
    - `yarn run build`
    - it will create a **dist** folder
2. Set your server URL in `example/index.html:29`
    - the `/api/v1/...` requests come from that server
3. Serve this `example/index.html` file with a simple HTTP server from the **root** directory of the project
    - suggest to use [http-server](https://www.npmjs.com/package/http-server)
    - install it globally via `npm install http-server -g`
    - then the serve is: `http-server .` in the root directory
    - open `http://localhost:<your-port>/example` to reach the example
