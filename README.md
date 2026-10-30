# AGU Games

The site page is `index.html`. The game files stay in the sibling `HTML games/UGS Files` folder and are served directly; they are not copied into this Git repository.

## Run locally

Do not open `index.html` by double-clicking it. Browsers block a page opened with `file://` from loading its neighboring game files.

1. Keep `gamesite` beside `HTML games` in your Downloads folder.
2. Run `start-local.command` (or `python3 serve_local.py` in Terminal).
3. The server opens `http://127.0.0.1:8000/`. Leave its Terminal window running while you play; press Ctrl+C to stop it.

The local server binds only to your own computer and maps `/games/` to `../HTML games/UGS Files/`.

## Publish the site and games

GitHub Pages hosts the small site interface. It cannot publish this game collection: the collection is about 2.8 GB, while GitHub Pages published sites may be no larger than 1 GB. The files therefore need a separate asset host.

This project includes a Cloudflare Worker that serves game files from an R2 bucket, strips common ad markup while streaming HTML, and provides direct New Tab and Download responses. Cloudflare R2 currently includes 10 GB of standard storage and has no egress charge; usage above included storage or operation allowances can be billed. Its public `r2.dev` URL is rate-limited, so the Worker endpoint is used instead.

### Set up Cloudflare once

1. Install Node.js if needed. In Terminal, run `export npm_config_cache="$PWD/.wrangler/npm-cache"` from this folder, then run `npx --yes wrangler@4.156.0 login`.
2. Create the bucket: `npx --yes wrangler@4.156.0 r2 bucket create agu-games-html`.
3. Deploy the Worker: `npx --yes wrangler@4.156.0 deploy`.
4. Upload the games: `python3 upload_games_to_r2.py`. This uploads about 2.8 GB; it can be safely rerun to retry failed files.
5. Copy the Worker URL printed by Wrangler. Its game base URL is that URL plus `/games/`.
6. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add `AGU_GAME_BASE_URL` with the Worker game base URL (for example, `https://agu-games-assets.<your-subdomain>.workers.dev/games/`).
7. Push to `main`. The Pages workflow writes that variable into `game-host-config.js` for the published site.

The bucket and account are private resources, so the first deployment and upload require your Cloudflare login. The site can still be published to GitHub before that; local play works as soon as you run the local server.

## GitHub Pages

The repository deploys through `.github/workflows/pages.yml`. In the repository's **Settings → Pages**, select **GitHub Actions** as the source.

## Browser settings

The title, favicon, color palette, and background image settings are stored in the browser's local storage. Large background images remain active for the current browser session if they exceed the browser's local-storage quota.
