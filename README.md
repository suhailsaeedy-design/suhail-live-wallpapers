# Suhail Live Wallpapers

**Suhail Live Wallpapers** is a free, installable web app by **Suhail Labs** for original procedural live and animated wallpapers.

It is designed to work without Apple Developer, Google Play Developer, a paid API, a database, or a paid hosting service.

## Features

- 22 original procedural animated wallpaper presets
- AMOLED, abstract, nature, space, cyber, fire, minimal, calm and other categories
- Responsive mobile + desktop UI
- Live canvas previews
- Search and category filters
- Favorites stored locally on the device
- Full-screen preview mode
- Save the current frame as PNG
- Record a short live clip where the browser supports Canvas capture and MediaRecorder
- Web Share / link-copy support
- Installable PWA
- Offline app-shell support
- No ads, login or analytics scripts in the current version
- GitHub Pages deployment workflow

## Run locally

Because the project has no build step, any static web server can serve it. Opening it through HTTPS is recommended so PWA and service-worker features work correctly.

## Free deployment with GitHub Pages

This repository includes .github/workflows/pages.yml.

In the repository on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions** if it is not already enabled. Pushes to main then deploy the site through the included workflow.

Expected project URL after Pages is enabled:

https://suhailsaeedy-design.github.io/suhail-live-wallpapers/

## Add a wallpaper

Add another object to data/wallpapers.js. The UI automatically reads the catalog, builds categories, search results and cards.

Each preset uses id, title, category, effect, colors and description.

Supported rendering effects currently include orbits, pulse, waves, rain, grid, particles, bubbles, ribbons, stars, lightning and nebula.

## Wallpaper limitation on phones

A website cannot directly set the operating system wallpaper. Users preview and export media from the website, then apply it using the phone's Photos/Gallery or wallpaper settings. Live-motion support depends on the browser, device and operating-system version.

## Suhail Labs

Integration metadata for the Suhail Labs website is in docs/SUHAIL_LABS_INTEGRATION.md.

Project progress and architecture notes are in docs/PROJECT_STATUS.md.

## License

MIT License — see LICENSE.

Copyright © 2026 Suhail Saeedy / Suhail Labs.
