# Dashboard Project

[![Deploy to Netlify](https://github.com/rush-limitless/Drive-test/actions/workflows/deploy-netlify.yml/badge.svg)](https://github.com/rush-limitless/Drive-test/actions/workflows/deploy-netlify.yml)

Static HTML dashboard ready for static hosting.

Files
- index.html: main page
- view.html: client view (read-only)
- edit.html: editor page (edit + export JSON)
- assets/tailwind.min.css: local Tailwind build (minified)
- src/tailwind.css: Tailwind input
- tailwind.config.js: Tailwind config
- DASHBOARD PROJECT 4.html: original source copy

Quick start
- Open index.html in a browser.

Deploy options (static)
- GitHub Pages: push repo, enable Pages on main branch.
- Netlify: drag-and-drop the folder or connect the repo.
- Vercel: import repo as a static site.

Notes
- Uses Google Fonts (requires internet).
- To rebuild Tailwind locally: `npx tailwindcss@3.4.13 -i src/tailwind.css -o assets/tailwind.min.css --minify`.
- Build output: `npm run build` generates `dist/` with `index.html`, `assets/`, and `data/`.
- API override: add `?api=https://example.com/data.json` to the URL to load remote data.
- Editor workflow: open `edit.html`, click APPLY to preview, then DOWNLOAD JSON and replace `data/dashboard.json` before sharing `view.html` or `index.html`.
- One-click publish (optional): set Netlify env vars `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`, then use the PUBLISH button in `edit.html`. Optional env var `PUBLISH_KEY` protects the endpoint.
- One-click publish via GitHub (recommended): set Netlify env vars `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, and `GITHUB_FILE_PATH` (defaults are `rush-limitless`, `Drive-test`, `main`, `data/dashboard.json`). Use the PUBLISH button in `edit.html` to commit, then GitHub Actions deploys.

GitHub Actions (auto deploy)
- Add repo secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
- On push to `main`, the workflow builds and deploys `dist/` to Netlify.

GitHub Pages (alternative hosting)
- In GitHub repo: Settings -> Pages -> Source: GitHub Actions.
- Push to `main` triggers deployment to Pages.
