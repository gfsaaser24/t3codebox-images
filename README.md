# t3codebox-images

[T3CodeBox](https://github.com/kristofk/T3CodeBox) images for T3 Code **nightly** and stable releases.
T3CodeBox itself publishes images only for stable T3 Code.

`.github/workflows/build.yml` runs every hour. It builds the newest T3 Code nightly and the newest stable
release that has no image yet:

1. T3CodeBox at the pinned commit (`T3CODEBOX_REF`) with that T3 Code release.
2. `browser-layer/`: the system libraries and fonts that T3's preview browser needs, and
   `T3CODE_SERVER_BROWSER_SANDBOX=0` (Docker's default seccomp profile blocks Chrome's sandbox).
3. `usage-hub-layer/`: a [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) usage hub plus a shim, so
   T3's **Usage → Limits** can show every Claude account, including ones signed in with long-lived
   `claude setup-token` tokens (see below).
4. T3CodeBox's own test suite on the final image.
5. A TruffleHog scan. A verified credential stops the build.
6. Push to `ghcr.io/gfsaaser24/t3codebox:<T3 Code version>`, e.g. `0.0.46-nightly.20261013.3066`.

Manual build: **Actions → Build T3CodeBox image → Run workflow** (optional version, optional force).

The images contain only public software. Never add secrets, hostnames or private configuration to this repo:
runtime configuration belongs in the deployment.

## Usage hub

T3 reads pooled account limits from a CLIProxyAPI hub (**Settings → Providers → Usage providers → Add hub**). For a
Claude account it asks the hub to call `https://api.anthropic.com/api/oauth/usage`. Long-lived Claude Code tokens
(`claude setup-token`, `sk-ant-oat01-…`) have only the `user:inference` scope, so that endpoint refuses them
(403, `user:profile` required). The same token still receives the `anthropic-ratelimit-unified-5h/7d-*` headers
on every Messages call. `usage-shim.js` sits in front of the hub, passes everything through, and on a refused
usage read makes a 1-token Haiku request with that account's token and answers T3 from those headers (cached
5 minutes per account).

The layer's entrypoint starts the hub (127.0.0.1:8317) and the shim (127.0.0.1:8318) only when the home volume has
`~/.cli-proxy-api/config.yaml`; without it the box behaves exactly as before. Set up a box once:

```yaml
# ~/.cli-proxy-api/config.yaml (mode 600)
config-version: 8
server: { host: "127.0.0.1", port: 8317 }
management: { allow-remote: false, secret-key: "<random management key>", disable-control-panel: true }
access: { api-keys: ["<random client key>"] }
oauth: { auth-dir: "/home/t3codebox/.cli-proxy-api/auths" }
```

Each Claude account is a file in `auths/`: `{"type":"claude","email":"<label>","access_token":"<token>"}`.
In T3, add the hub with URL `http://127.0.0.1:8318` (the shim) and the management key.
