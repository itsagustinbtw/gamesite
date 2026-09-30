# AGU Games

A fast, minimal dark-themed browser game site.

## Run locally

Open `index.html` in a browser, or serve it with a simple local web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy with GitHub Pages

This repo is configured for GitHub Pages deployment using a static site workflow.

1. Push to GitHub
2. Open the repository settings
3. Go to Pages
4. Select "GitHub Actions"
5. Wait for the workflow to finish

## Notes

- The site loads a remote game catalog and uses GitHub-hosted assets.
- Custom theme and branding settings are saved in browser local storage.
