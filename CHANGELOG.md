# Changelog

## 4.1.1 (2026-10-06)

### Added

- Added a community proxy notice to the popup and the settings dashboard, asking users to use their own proxy.

### Changed

- Proxy error notifications now appear once after five consecutive proxy errors instead of on every error.
- Errors raised during a proxy test no longer count toward the notification, and any completed proxied request resets the count.

### AMO release notes

CR-Unblocker 4.1.1 reduces proxy error notification noise and adds a notice to the popup and settings asking users to use their own proxy, since the free community proxy is crowded. A notification now appears once after five consecutive proxy errors, and a successful proxied request resets the count.

## 4.1.0 – 2026-07-20

### Added

- Added structured local diagnostics for proxy decisions, request lifecycle events, response failures, proxy tests, and keep-alive checks.
- Added Error, Warning, Info, Debug, and Trace log levels with dashboard filtering and JSONL export.
- Added direct controls for proxying static assets and media/video traffic.
- Added an explicit bandwidth warning recommending a private server when media proxying is enabled.

### Changed

- Static assets and media/video remain direct by default to reduce latency and community-proxy bandwidth usage.
- JSON/XML API traffic is no longer assumed to be static and can follow the proxy route when needed for region access.
- Proxy diagnostics no longer print proxy credentials and do not send debug logs to the community proxy.
- Improved the settings layout and grouped traffic, proxy, and diagnostic controls.

### AMO release notes

CR-Unblocker 4.1.0 adds local troubleshooting diagnostics and clearer traffic controls. Static assets and media/video are direct by default; users can opt into proxying either category. The extension stores bounded diagnostic events locally and does not transmit them to the proxy service.
