# Thin layer on top of a tested t3codebox image: lets T3's built-in preview browser (chrome-headless-shell,
# downloaded into ~/.t3/tools) start inside the box. Changes nothing else: same t3, same files, same user.
ARG BASE
FROM ${BASE}
ARG SOURCE
USER root
# Libraries = the DEBIAN_PACKAGES list in t3's `browser setup` (Debian 13 names) + fonts, else pages render as boxes.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libnss3 libglib2.0-0t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libdbus-1-3 \
      libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libxkbcommon0 \
      libgbm1 libasound2t64 libexpat1 \
      fontconfig fonts-liberation fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*
USER 1000:1000
# Docker's default seccomp/AppArmor block Chrome's user-namespace sandbox in a container (same as the browser
# container, which runs Chromium with --no-sandbox). The box container stays the isolation boundary.
ENV T3CODE_SERVER_BROWSER_SANDBOX=0
# Links the GHCR package to the repo that builds it.
LABEL org.opencontainers.image.source="${SOURCE}"
