# Deploying KHARIS & ALETHEIA

The storefront (`web/`) is a Next.js 16 app that ships as a single Docker container.
This guide is written for a Windows machine with no prior Docker experience, but the
same `docker compose` commands work identically on macOS/Linux.

## 1. Install Docker

1. Install **Docker Desktop for Windows**: https://www.docker.com/products/docker-desktop/
2. Docker Desktop requires **WSL2** (Windows Subsystem for Linux). The installer offers
   to set this up automatically — accept it, then restart Windows when prompted.
3. Open Docker Desktop once and wait for it to say **"Docker Desktop is running"**
   (whale icon steady in the system tray / menu bar).

## 2. Get the project files

Copy this whole project folder (the one containing this file, `docker-compose.yml`,
and the `web/` folder) onto the machine — e.g. via the same Google Drive / USB /
zip you were given. Nothing needs to be installed globally; Docker builds everything
inside the container.

## 3. Configure (optional but recommended before a real launch)

The site works out of the box with placeholder values. Before taking real orders,
set the owner's real details:

1. Open a terminal (PowerShell) in this folder and copy the example config:
   ```
   copy .env.example .env
   ```
   (macOS/Linux: `cp .env.example .env`)
2. Open `.env` in Notepad and fill in what you have. Every line is optional — leave
   blank to keep the built-in placeholder.

| Variable | What it controls | Placeholder if unset |
|---|---|---|
| `NEXT_PUBLIC_CONTACT_EMAIL` | Where the mailto: fallback on contact/bulk/gift forms and order notices go | `hello@kharisandaletheia.com` |
| `NEXT_PUBLIC_FORM_ENDPOINT` | An HTTPS form-submission endpoint (e.g. Formspree). Must start with `https://` or it's ignored. Leave blank to always use the mailto: fallback | *(blank — mailto: only)* |
| `NEXT_PUBLIC_PAYMENT_PROVIDER` | `request` emails every order for manual processing (default, no payment account needed). Set to `paystack` once a Paystack account exists | `request` |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key — only read when the provider above is `paystack` | *(blank)* |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL used in page metadata, JSON-LD and share links — set this to the real domain once one exists | `https://www.kharisandaletheia.com` |

> These are **build-time** values (Next.js compiles them into the app). If you change
> `.env` after the first launch, re-run the build command below — a plain restart
> won't pick up the new values.

Other real values that still need the owner's input before launch (shipping rates,
promo codes, payment account) live in `web/lib/config.ts` and are listed in
`KA_CONFIG.placeholders` in that file — not environment variables, since they're
structured data (rate tables, tier lists) rather than single strings.

## 4. Build and run

From this folder (the one with `docker-compose.yml`):

```
docker compose up -d --build
```

First run takes a few minutes (downloading the Node base image, installing
dependencies, compiling the site). Subsequent rebuilds are faster.

The site is now running at **http://localhost:3000**.

## 5. Everyday commands

| Task | Command |
|---|---|
| Stop the site | `docker compose stop` |
| Start it again (no rebuild) | `docker compose start` |
| View logs | `docker compose logs -f web` |
| Rebuild after changing `.env` or the code | `docker compose up -d --build` |
| Fully remove the container | `docker compose down` |

The container restarts automatically if it crashes or the machine reboots
(`restart: unless-stopped`), as long as Docker Desktop is running.

## 6. Putting it on the internet

`docker compose up -d --build` only exposes the site on the machine it runs on
(`localhost:3000`). To make it publicly reachable you still need one of:

- Port-forward 80/443 on the router to this machine and put a reverse proxy
  (e.g. Caddy, nginx, or Cloudflare Tunnel) in front of port 3000 for HTTPS, or
- Run the same `docker compose up -d --build` on a cloud VM / VPS instead of a
  local Windows machine, with a domain pointed at it and a reverse proxy for TLS.

Either way, once `NEXT_PUBLIC_SITE_URL` in `.env` matches the real public domain,
rebuild (`docker compose up -d --build`) so metadata/share links use it.

## Launch checklist

- [ ] Docker Desktop installed and running
- [ ] `docker compose up -d --build` succeeds and http://localhost:3000 loads
- [ ] `.env` filled in with the real contact email (at minimum)
- [ ] Shipping rates, promo codes and payment provider reviewed in
      `web/lib/config.ts` (see `KA_CONFIG.placeholders`)
- [ ] Every page reachable from the nav/footer loads with no visible errors, in
      both light and dark theme
- [ ] A full order can be placed end to end: add to cart → checkout → order
      confirmation
- [ ] The Tee Studio, Print Lab and Bulk calculator all work and "Send to Tee
      Studio" from the Lab carries the print over
- [ ] A domain + HTTPS reverse proxy is in place before sharing the link publicly,
      and `NEXT_PUBLIC_SITE_URL` matches that domain
