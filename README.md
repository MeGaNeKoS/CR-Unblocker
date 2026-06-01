# CR-Unblocker 4.0

CR-Unblocker helps accessing region locked anime on Crunchyroll without the need for a VPN. The extension proxies geo-restricted Crunchyroll traffic through a U.S. server while loading static assets directly so the site stays fast and responsive.

## I've heard it isn't safe?
Only the geo-blocked Crunchyroll traffic goes through our proxy—no logging or similar. If you do not trust our servers, you are free to configure your own SOCKS or HTTP proxy in the extension settings. Please note that we can not be held responsible for compromised accounts.

## Installing
Install CR-Unblocker for Firefox desktop or Android from [AMO](https://addons.mozilla.org/firefox/addon/crunchy-unblocker).

The extension was previously available on the Chrome and Edge stores, but has since been removed. The old version used a cookie-based session swapping approach which no longer works. The extension was later rewritten to use Firefox's `browser.proxy.onRequest` API for proxy routing, which means the current version only works on Firefox.

### Chrome / Chromium users

For Chrome, Edge, Brave, and other Chromium-based browsers, use [GeoBypasser](https://github.com/MeGaNeKoS/GeoBypasser) instead. It is a generic proxy/routing extension rather than a Crunchyroll-specific unblocker, and it is available on the [Chrome Web Store](https://chromewebstore.google.com/detail/geobypass/ihocglepfddiancfooeablkngmckkjdm). Chrome Web Store policy can be strict about extensions whose sole purpose is bypassing restrictions on a specific website, so the generic routing approach is easier to publish and safer from future removal.

GeoBypasser can import service-specific rules, including the maintained [Crunchyroll rule](https://github.com/MeGaNeKoS/GeoBypass-Rules/blob/main/Crunchyroll/Crunchyroll-rule.json). This is the preferred Chromium path because it keeps the browser extension generic while the rules define which traffic should use the proxy.

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
