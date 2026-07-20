# Changelog

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
