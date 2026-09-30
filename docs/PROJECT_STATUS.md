# Project status

## Current phase

Version 2 feature expansion is implemented and deployed through the main branch.

## Included

- Responsive mobile and desktop interface
- Sticky desktop header and mobile bottom navigation
- Dark and Light themes with local preference
- 70 online wallpaper presets; six uploaded photorealistic wallpapers are prioritized at the top of the catalog
- Photorealistic City, Office, Islamic, Nature and Places wallpapers plus Nature, City, Places, Office and Youth generated scene categories
- Added live effects for comets, fireflies, liquid light, animated rings, snowfall and laser horizons
- Existing AMOLED, Dark, Abstract, Space, Cyber, Fire, Minimal, Calm and Luxury effects
- Search and category filters while online
- Local favorite IDs
- Full-screen live preview
- Fixed mobile preview controls so Favorite and Close no longer overlap
- 1290×2796 PNG export
- Share-sheet based Save Image / Gallery flow where supported
- Six-second live recording where Canvas capture + MediaRecorder are available
- Share/copy-link flow
- Installable PWA manifest
- Offline app-shell service worker
- Wallpaper catalog intentionally network-only
- Automatic connection-state UI and retry behavior
- Animated creator About page using the approved Suhail Saeedy portrait\n- Direct Open Suhail Labs button in About
- GitHub Pages deployment workflow
- Automated syntax / JSON / required-file quality checks
- Suhail Labs integration notes

## Offline design

Cached offline:
- Interface shell
- About page
- Creator portrait
- Usage guide
- Theme controls

Online-only:
- Wallpaper catalog
- Search/categories
- Wallpaper previews
- Favorite previews
- Wallpaper exports

The service worker must never cache `data/wallpapers.json`.

## Architecture

The project uses plain HTML, CSS and JavaScript with no paid runtime service.

- Wallpaper metadata: `data/wallpapers.json`
- Rendering and app state: `assets/js/app.js`
- Visual system: `assets/css/styles.css`
- Creator image: `assets/images/suhail-saeedy-about-approved.jpeg`\n- Photorealistic wallpaper files: `assets/wallpapers/real/`
- Offline policy: `service-worker.js`

## Rule for future changes

Keep wallpaper data separate from UI/rendering logic. Maintain the online-only catalog rule unless the product requirement changes. Preserve the offline shell and avoid adding paid runtime dependencies without an explicit project decision.

## Deployment

GitHub Pages source uses GitHub Actions.

- Six additional photorealistic wallpapers are placed at the very top of the catalog: Aurora Snowy Cabin, Tropical Lagoon Sunrise, Lavender Golden Hour, Skyline Reading Lounge, Grand Canyon Golden River and Sakura Koi Garden.

- Home Screen/PWA mode now refreshes the app shell and wallpaper catalog automatically without requiring removal/reinstallation.
- Mobile installed mode has a compact safe-area-aware top bar so iOS status controls no longer overlap app controls.
- Realistic photo wallpapers use localized live motion presets, and Download now offers Live wallpaper and Simple image choices.
- Six additional realistic location wallpapers were added, bringing the catalog to 70.
