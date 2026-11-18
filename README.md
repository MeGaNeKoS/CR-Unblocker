# CR-Unblocker 4.1

CR-Unblocker is a Firefox extension that routes Crunchyroll requests through a proxy server: the community proxy, or one you configure yourself. Static assets and media load directly by default so the site stays fast and the proxy carries as little traffic as possible. The extension only selects a proxy for each request; it does not read or change cookies, headers, or sessions.

## I've heard it isn't safe?
Only the routed Crunchyroll traffic goes through our proxy. Extension diagnostics are bounded and stored locally in the browser; debug logs are not sent to our servers. If you do not trust our servers, you are free to configure your own SOCKS or HTTP proxy in the extension settings. Please note that we can not be held responsible for compromised accounts.

## Installing
Install CR-Unblocker for Firefox desktop or Android from [AMO](https://addons.mozilla.org/firefox/addon/crunchy-unblocker).

Versions before 4.0.0 were built by previous maintainers on a different design and are no longer distributed or supported. The current version is built on Firefox's `browser.proxy.onRequest` API, so it only works on Firefox.

### Diagnostics and traffic controls

The dashboard includes local request diagnostics with selectable log levels. Static assets and media/video are direct by default to reduce latency and community-proxy bandwidth usage. The settings page allows either category to be routed through the proxy when troubleshooting requires it; use a private server when proxying media/video.

### Chrome / Chromium users

For Chrome, Edge, Brave, and other Chromium-based browsers, use [GeoBypasser](https://github.com/MeGaNeKoS/GeoBypasser) instead. It is a generic proxy router where you choose which websites use which proxy, and it is available on the [Chrome Web Store](https://chromewebstore.google.com/detail/geobypass/ihocglepfddiancfooeablkngmckkjdm).

## Status & Monitoring
We publish live service status at [community-proxy.meganeko.dev/monitor](https://community-proxy.meganeko.dev/monitor), which also feeds our uptime robot alerts. If you want to inspect the HAProxy backend directly, the raw statistics dashboard is available at [community-proxy.meganeko.dev/stats](https://community-proxy.meganeko.dev/stats).

## Firefox Android Tips

* **To adjust settings:**
  Tap the three dots menu -> Add-ons -> CR-Unblocker -> Make your changes.

* **To open Crunchyroll via CR-Unblocker:**
  Open any website -> tap the three dots menu -> Add-ons -> CR-Unblocker -> Open Crunchyroll.

## Requirements

It is not strictly required, but to run the helper commands for testing and packing the extension you should have these installed:

* nodejs 16

## Building

To pack the extension for the extension store you need to follow these steps:

```bash
npm run build
```

## Using a private proxy
If you really don't trust us or the server is offline you can point the extension to any SOCKS proxy. See the extension settings.

## Contributing
The extension is always under development. Some features might be added later. If you have any idea on what to add feel free to contribute to the project or open an issue.
