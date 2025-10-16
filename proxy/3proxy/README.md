# 3proxy + HAProxy Docker Preset (Single-Port HTTP+SOCKS)

This directory contains a minimal, production-friendly preset to run a small authenticated proxy that accepts both HTTP and SOCKS on a single TCP port using HAProxy + 3proxy. It is intended for powering CR‑Unblocker with your own infrastructure.

What you get
- Single public port (default `5445`) that automatically detects HTTP vs SOCKS.
- Auth-required proxy (username/password) using 3proxy.
- Clean, IPv4/IPv6-capable internal network layout.
- Simple Docker Compose deployment you can spin up in minutes.

---

## Quick Start (Self‑Hosted Preset)

Prerequisites
- Docker Engine 20.10+ and Docker Compose plugin.
- A VM or server with a public IPv4 (IPv6 optional).
- Ability to open inbound TCP on your chosen port (default `5445`).

1) Configure credentials
Edit `3proxy/3proxy.cfg` and set a strong username/password on the `users` line.

Example:
```
users myuser:CL:My$uperStrongP@ssw0rd
```

2) Start the proxy stack
```bash
docker compose -p proxy -f docker-compose.proxy.yml up -d
```

3) Open firewall
- Allow inbound TCP on the port you expose in `docker-compose.proxy.yml` (default `5445`).

4) Test from your machine
```bash
# HTTP proxy over single port
curl -x http://myuser:My$uperStrongP@ssw0rd@<server-ip>:5445 https://ipinfo.io/ip

# SOCKS5 proxy over the same port
curl --socks5 myuser:My$uperStrongP@ssw0rd@<server-ip>:5445 https://ipinfo.io/ip
```

---

## Point CR‑Unblocker at Your Proxy

In the extension settings:
- Proxy type: either `HTTP` or `SOCKS5` both work on port `5445`.
- Host: your server’s IP or DNS name.
- Port: `5445` (or the one you configured).
- Username / Password: the ones you set in `3proxy.cfg`.

Tip: If you prefer to bypass HAProxy and use dedicated ports (`8080` HTTP / `1080` SOCKS), add a `ports:` mapping to the `3proxy` service in `docker-compose.proxy.yml`.

---

## Changing Port or Hardening Access

- Change public port: edit `ports` in `docker-compose.proxy.yml` under the `haproxy` service (left side of the mapping), e.g. `"8443:5445"`.
- Restrict by IP: run behind a cloud firewall or security group allowing only your own IPs.
- Rotate creds regularly: update the `users` line in `3proxy/3proxy.cfg` and restart.

Restart after changes
```bash
docker compose -p proxy -f docker-compose.proxy.yml down
docker compose -p proxy -f docker-compose.proxy.yml up -d
```

---

## Files You May Want to Edit

- `3proxy/3proxy.cfg` — authentication and proxy listeners (ports `8080`/`1080`).
- `haproxy/haproxy.cfg` — single‑port protocol detection and routing.
- `docker-compose.proxy.yml` — service definitions, published port, and network.

Defaults
- HAProxy listens on `5445` and routes to 3proxy’s HTTP (`8080`) and SOCKS (`1080`).
- 3proxy listens on both IPv4 and IPv6 internally; authentication is mandatory.
- Compose creates an internal IPv6‑enabled bridge network (`proxy-net`) with subnet `fd00:0:0:1::/64` automatically. No external networks required.

---

## Verifying

Local host test
```bash
curl -x http://myuser:mypass@localhost:5445 https://example.com -I
```

External test (from a different machine)
```bash
curl --socks5 myuser:mypass@your.server.com:5445 https://example.com -I
```

If requests succeed (2xx/3xx/4xx headers returned), your proxy is reachable and authenticating correctly. Connection errors usually indicate firewall, port mapping, or credential issues.

---

## Troubleshooting

- Connection refused/timeouts: verify your firewall and that `haproxy` is publishing the expected port.
- Auth failures: ensure the `users` line in `3proxy.cfg` matches the credentials you’re using.
- IPv6 quirks: if your host lacks IPv6, keep the internal network IPv6‑enabled but it’s fine if only IPv4 is public.
- Container won’t start: run `docker compose ... logs -f` for `haproxy` and `3proxy` to see config errors.

---

## Optional: Web/TLS Stack

If you also need a public web front with TLS (for hosting a status page or other sites), you can add a separate Nginx + Certbot stack and place it on a different published port or hostname. That is not required for the proxy preset above and is intentionally kept separate to stay minimal.

---

## Credits

- HAProxy — protocol detection and single‑port multiplexing
- 3proxy — lightweight HTTP/SOCKS proxy with auth
- Docker — containerization
