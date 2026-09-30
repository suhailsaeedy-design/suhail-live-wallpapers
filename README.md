# Suhail Live Wallpapers

**Suhail Live Wallpapers** is a free installable PWA by **Suhail Labs**, created by **Suhail Saeedy**.

The project runs on GitHub Pages and does not require Apple Developer, Google Play Developer, a paid API, a database, or paid hosting.

## Current features

- 40 live wallpaper presets
- Nature, City, Places, Office, Youth, AMOLED, Dark, Abstract, Space, Cyber, Fire, Minimal, Calm and Luxury categories
- Realistic-style animated scene presets for mountains, forests, coastlines, roads, rainy cities, offices, studios and youth/street themes
- Full-screen live Canvas preview
- Search and category filters
- Local favorites
- Dark mode and Light mode with saved preference
- High-resolution 1290×2796 PNG export
- Device share-sheet integration for saving images to Photos/Gallery where supported
- Six-second live clip recording where Canvas capture + MediaRecorder are supported
- PWA installation
- Offline app shell
- Animated About page with the creator portrait
- No login, ads, paid API, analytics script, or database in the current version

## Offline behavior

The installed app shell is cached after the first successful visit.

The following continue to work offline:

- Home interface and navigation
- About page and creator portrait
- How-to-use guide
- Theme switching
- General PWA shell

The following intentionally require an internet connection:

- Wallpaper catalog
- Wallpaper search and categories
- Favorite wallpaper previews
- Wallpaper preview/export actions

When the connection is unavailable, the UI shows a clear network message instead of displaying stale wallpaper catalog data.

## Saving wallpapers to Photos / Gallery

A web app cannot silently write files into a phone's Photos/Gallery library or directly change the system wallpaper.

The **Save photo** action creates a high-resolution PNG. On compatible mobile browsers, the system share sheet is used so the user can choose an approved action such as **Save Image**. Other browsers receive a normal file download.

The **Save live clip** action records the animated Canvas where the browser exposes Canvas capture and MediaRecorder. If the browser does not support that API, the UI instructs the user to use the phone's built-in screen recorder.

## Architecture

- `index.html` — SPA/PWA interface
- `assets/css/styles.css` — responsive dark/light design system
- `assets/js/app.js` — routing, themes, online/offline state, renderers, export logic
- `data/wallpapers.json` — online-only wallpaper catalog
- `assets/images/suhail-saeedy-about.webp` — creator portrait used by About
- `service-worker.js` — offline app-shell cache and network-only wallpaper catalog policy

## Free deployment with GitHub Pages

GitHub Pages is configured through `.github/workflows/pages.yml`.

Live URL:

https://suhailsaeedy-design.github.io/suhail-live-wallpapers/

## Add a wallpaper

Add a new object to `data/wallpapers.json`.

Wallpaper fields include:

- `id`
- `title`
- `category`
- `effect`
- `colors`
- `description`
- optional `scene` for realistic-style live scene presets

## Suhail Labs

Integration metadata is documented in `docs/SUHAIL_LABS_INTEGRATION.md`.

Development status is documented in `docs/PROJECT_STATUS.md`.

## License

MIT License — see `LICENSE`.

Copyright © 2026 Suhail Saeedy / Suhail Labs.
