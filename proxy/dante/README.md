# Dante SOCKS5 Preset (VPN Egress)

This folder contains a minimal Dante (danted) configuration to run a small, authenticated SOCKS5 proxy that sends all proxied traffic out through a VPN interface and only allows Crunchyroll domains. It is intended for powering CR-Unblocker with your own infrastructure.

What you get
- SOCKS5 proxy on port `1080` (changeable) bound on all interfaces.
- Auth required via system users (default user example: `crunblocker`).
- Outbound/eXternal interface pinned to your VPN (default `tun0`).
- Access limited to `*.crunchyroll.com` by default.

---

## Quick Start (Ubuntu/Debian)

Prerequisites
- A Linux VM or server with root/sudo.
- A working VPN on the host that creates an interface (e.g. `tun0` for OpenVPN or `wg0` for WireGuard). Adjust the `external:` line in the config accordingly.
- Ability to open inbound TCP to your proxy port (default `1080`). Restrict to your own IP(s).

1) Install Dante server
```bash
sudo apt update
sudo apt install -y dante-server
```

2) Create the proxy user and set a strong password
```bash
sudo adduser --gecos "" crunblocker
# set a strong password when prompted; you will use these credentials in the extension
```

3) Deploy the config
```bash
# from the repository root
sudo cp proxy/dante/danted.conf /etc/danted.conf

# edit if your VPN interface is not tun0, or to change the listen port
sudo nano /etc/danted.conf
```

Important lines to review in `/etc/danted.conf`:
- `external: tun0` → change to your VPN egress interface (e.g. `wg0`).
- `internal: 0.0.0.0 port=1080` → change the port if desired.
- `user.unprivileged: crunblocker` → must be an existing system user.
- `socks pass { … to: .crunchyroll.com … }` → restricts proxy use to Crunchyroll.

4) Start and enable the service
```bash
sudo systemctl enable --now danted
sudo systemctl status danted --no-pager
```

5) Open firewall (lock to your IP)
```bash
# replace 203.0.113.10 with your client IP
sudo ufw allow from 203.0.113.10 to any port 1080 proto tcp
```

6) Test from your machine
```bash
# Replace <server-ip> and <password>
curl --socks5 crunblocker:<password>@<server-ip>:1080 https://www.crunchyroll.com/ -I
```

If you prefer to test against a generic site, temporarily relax the `socks pass` rule to:
```
socks pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect error disconnect
}
```
Remember to restore the Crunchyroll-only rule afterwards.

---

## Point CR-Unblocker at Your Proxy

In the extension settings:
- Proxy type: `SOCKS5`
- Host: your server IP or DNS name
- Port: `1080` (or the one you configured)
- Username / Password: the system user you created (default example `crunblocker`)

Only geo-gated Crunchyroll requests are routed through the proxy by the extension. Static assets load directly for speed.

---

## Security Notes

- Keep `socksmethod: username` (authentication required). Do not run an open proxy.
- Restrict inbound access to trusted IPs using your cloud firewall or `ufw`/security groups.
- Use strong, unique credentials; rotate them periodically.
- Ensure the VPN interface referenced by `external:` is up before starting `danted`.

---

## Troubleshooting

- Service won’t start: `journalctl -u danted -xe` to see config errors.
- No VPN interface: `ip a` and confirm `tun0`/`wg0` exists and is up; edit the `external:` line accordingly.
- Auth failures: confirm the system user exists and the password is correct.
- Can’t connect from client: verify firewall rules and that port `1080` is open to your IP.
- Requests blocked: the default rule only allows `*.crunchyroll.com`. Expand or adjust the `socks pass` rule for debugging.

---

## File Overview

- `danted.conf` — drop-in config for `/etc/danted.conf` configured to:
  - listen on `0.0.0.0:1080`
  - run unprivileged as `crunblocker`
  - send outbound traffic via `tun0`
  - allow only Crunchyroll destinations

---

## RHEL/Alma/Rocky and Others

Package names and service units vary. If `dante-server` is unavailable, install from source or use your distro’s equivalent (`danted`). The config filename is typically `/etc/danted.conf` or `/etc/sockd.conf` — adjust the copy path and service name accordingly.

