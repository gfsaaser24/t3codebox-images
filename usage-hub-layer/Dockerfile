# Thin layer on top of a tested t3codebox image: a CLIProxyAPI usage hub for T3's Settings → Providers → Usage
# providers → Add hub, plus a shim that lets long-lived Claude Code tokens report their limits there.
# Both start only when the box has ~/.cli-proxy-api/config.yaml (the home volume), so the image holds no
# configuration and no credentials.
ARG BASE
FROM ${BASE}
ARG SOURCE
ARG CLIPROXYAPI_VERSION=8.0.32
USER root
RUN case "$(dpkg --print-architecture)" in amd64) arch=amd64 ;; arm64) arch=aarch64 ;; esac \
 && file="CLIProxyAPI_${CLIPROXYAPI_VERSION}_linux_${arch}.tar.gz" \
 && base="https://github.com/router-for-me/CLIProxyAPI/releases/download/v${CLIPROXYAPI_VERSION}" \
 && cd /tmp \
 && curl -fsSLO "${base}/${file}" \
 && curl -fsSL "${base}/checksums.txt" | grep " ${file}$" | sha256sum -c - \
 && install -d /usr/local/lib/t3codebox-usage-hub \
 && tar -xzf "$file" -C /usr/local/lib/t3codebox-usage-hub --no-same-owner cli-proxy-api LICENSE \
 && rm -f "$file"
COPY usage-shim.js /usr/local/lib/t3codebox-usage-hub/usage-shim.js
COPY t3codebox-usage-hub /usr/local/bin/t3codebox-usage-hub
RUN chmod 755 /usr/local/bin/t3codebox-usage-hub
USER 1000:1000
# Starts the hub and the shim, then hands over to T3CodeBox's own entrypoint. ENTRYPOINT resets CMD, so both
# are restated with the base image's values.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/t3codebox-usage-hub"]
CMD ["t3", "serve"]
LABEL org.opencontainers.image.source="${SOURCE}"
