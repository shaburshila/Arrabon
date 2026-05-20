# Deployment Map

Use this file to avoid confusion between similar generated assets.

## Canonical public assets

Copy these into the app:

```txt
public/favicon.svg
public/favicon.ico
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-192-maskable.png
public/icons/icon-512-maskable.png
```

## Source/export folders

These folders are for design/dev reference and export:

```txt
brand/      # source SVG marks: Alpha Lock, app icon variants, secondary Seal
favicon/   # generated favicon source sizes and favicon.ico
pwa/       # complete generated PNG sizes: 16, 32, 48, 64, 128, 192, 256, 512
status/    # standalone colored status icons
utility/   # standalone colored utility icons
*/currentColor/ # React/UI-safe variants controlled by CSS color
```

## Recommended app usage

- Use `public/favicon.svg` as canonical SVG favicon.
- Use `public/icons/icon-192.png` and `public/icons/icon-512.png` in `manifest.webmanifest`.
- Use `arrabon-icon-sprite.svg` or individual `currentColor` SVGs for UI components.
- Use colored standalone SVGs only for static exports/docs.
- Do not use the Arrabon Seal as a normal UI icon.
