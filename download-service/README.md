# WinDirStat versioned download names

This Cloudflare Worker gives one GitHub release asset a second, versioned download name without storing or normally
proxying another copy of the file. Public links first open the static launcher at `windirstat.net/downloads/`, which
hands the request to the Worker without requiring control of the domain's DNS.

The endpoint accepts paths such as:

```text
https://windirstat.net/downloads/#/v2.7.0/WinDirStat-2.7.0-x64.msi
```

Only `GET` and `HEAD`, semantic versions, and the supported stable-release asset names are accepted. The normal path
rewrites GitHub's temporary CDN response-disposition parameter and redirects the client, so GitHub continues to serve
the file. If GitHub changes that redirect format, the Worker follows the canonical asset and streams it with the
requested `Content-Disposition` while preserving range and conditional request headers.

## Deployment

Run `npm install` and `npm test` from this directory. For later deployments, authenticate once with
`npx wrangler login`, then run `npm run deploy`. The static launcher forwards validated paths to
`https://windirstat-downloads.windirstat.workers.dev`, so update `downloads/redirect.js` if that hostname ever changes.
