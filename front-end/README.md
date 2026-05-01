# Frontend

Build the production bundle:

```sh
bun run build
```

Serve the built `dist` folder with SPA route fallback:

```sh
bun run serve:dist
```

Do not use a plain static file server for `dist` unless it supports history fallback to
`index.html`. This app uses React Router `BrowserRouter`, so refreshing URLs like
`/wallet` or `/tournament/123` requires the server to return `index.html` for unknown
frontend routes.
