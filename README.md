# t3codebox-images

[T3CodeBox](https://github.com/kristofk/T3CodeBox) images for T3 Code **nightly** and stable releases.
T3CodeBox itself publishes images only for stable T3 Code.

`.github/workflows/build.yml` runs every hour. It builds the newest T3 Code nightly and the newest stable
release that has no image yet:

1. T3CodeBox at the pinned commit (`T3CODEBOX_REF`) with that T3 Code release.
2. `browser-layer/`: the system libraries and fonts that T3's preview browser needs, and
   `T3CODE_SERVER_BROWSER_SANDBOX=0` (Docker's default seccomp profile blocks Chrome's sandbox).
3. T3CodeBox's own test suite on the final image.
4. A TruffleHog scan. A verified credential stops the build.
5. Push to `ghcr.io/gfsaaser24/t3codebox:<T3 Code version>`, e.g. `0.0.46-nightly.20261013.3066`.

Manual build: **Actions → Build T3CodeBox image → Run workflow** (optional version, optional force).

The images contain only public software. Never add secrets, hostnames or private configuration to this repo:
runtime configuration belongs in the deployment.
