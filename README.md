# AGU Games

The site page is `index.html`. The game files stay in the sibling `HTML games/UGS Files` folder and are served directly; they are not copied into this Git repository.

## Run locally

Do not open `index.html` by double-clicking it. Browsers block a page opened with `file://` from loading its neighboring game files.

1. Keep `gamesite` beside `HTML games` in your Downloads folder.
2. Run `start-local.command` (or `python3 serve_local.py` in Terminal).
3. The server opens `http://127.0.0.1:8000/`. Leave its Terminal window running while you play; press Ctrl+C to stop it.

The local server binds only to your own computer and maps `/games/` to `../HTML games/UGS Files/`.

## Published site and games

The main site is hosted at both <https://history.mathandscience.workers.dev/> and <https://agu-games-site.pages.dev/>. The Worker root serves the site's static files, and `/games/` continues to serve games from R2. The Cloudflare Pages project is a backup copy uploaded directly. The game collection is about 3.00 GB, so the site stays small while a separate service hosts game files.

This project includes a Cloudflare Worker that serves game files from an R2 bucket, strips common ad markup while streaming HTML, and provides direct New Tab and Download responses. Cloudflare R2 currently includes 10 GB of standard storage and has no egress charge; usage above included storage or operation allowances can be billed. Its public `r2.dev` URL is rate-limited, so the Worker endpoint is used instead.

### Set up Cloudflare once

1. Install Node.js if needed. In Terminal, run `export npm_config_cache="$PWD/.wrangler/npm-cache"` from this folder, then run `npx --yes wrangler@4.156.0 login`.
2. Create the bucket: `npx --yes wrangler@4.156.0 r2 bucket create agu-games-html`.
3. Deploy the Worker: `npx --yes wrangler@4.156.0 deploy`.
4. Upload the games: `python3 upload_games_to_r2.py`. This uploads about 3.00 GB; it can be safely rerun to retry failed files. Wrangler caps individual uploads at 300 MiB, so files over that size use R2's S3 multipart API. For those, install `boto3` and set `R2_ACCOUNT_ID`, `R2_S3_ACCESS_KEY_ID`, and `R2_S3_SECRET_ACCESS_KEY` using a short-lived token scoped to this bucket.
5. Copy the Worker URL printed by Wrangler (this repository is connected to the Worker named `history`). Its game base URL is that URL plus `/games/`.
6. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add `AGU_GAME_BASE_URL` with the Worker game base URL (for example, `https://history.<your-subdomain>.workers.dev/games/`).
7. The Worker build runs `node cloudflare/prepare_site.mjs` before `npx wrangler deploy`. That script copies the current site pages and images to the Worker static-assets folder, so the main site and games update together when you push to `main`. The Pages backup can be updated from **Workers & Pages → agu-games-site → Create deployment** by uploading the site HTML, `game-host-config.js`, `theme-store.js`, and the two image files.

The bucket and account are private resources. Create the bucket in the same Cloudflare account used by the connected Worker Builds project before deploying; otherwise `wrangler deploy` fails with “R2 bucket not found.” The first deployment and upload also require Cloudflare login. The site can still be published to GitHub before that; local play works as soon as you run the local server.

### Cost safeguards

The R2 bucket uses Standard storage and is private; game requests go through the `history` Worker. The source collection is about 3.00 GB (decimal), below R2's included 10 GB-month, and the upload stores about 2,966 game objects, below the included 1 million Class A operations. R2 has no egress fee. Cloudflare Worker static asset requests are free and unlimited; only `/games/` requests run the Worker and read from R2.

The Cloudflare account is currently on the Workers Free plan, which stops Worker requests at 100,000 per day. Each Worker request makes at most one R2 read; even 31 days at that account-wide cap is at most 3.1 million Class B reads, below R2's included 10 million per month. Requests above the Workers Free limit fail instead of moving this Worker to a paid plan. Keep the Workers plan on Free and the bucket on Standard; do not upgrade the plan or switch to Infrequent Access.

A $0.01 account budget alert is configured as an early warning. Cloudflare budget alerts are notifications only; they do not cap spending. Free usage is conditional on these plan and quota limits remaining in place, and R2 allowances are shared by the Cloudflare account. Check **Billing → Billable usage** if other Cloudflare resources are added.

## GitHub Pages mirror

The repository still has a GitHub Pages workflow in `.github/workflows/pages.yml`; the Cloudflare Pages URL above is the primary hosted site. GitHub Pages can remain as a mirror or fallback.

## Browser settings

The title, favicon, color palette, and background image settings are stored in the browser's local storage. Large background images remain active for the current browser session if they exceed the browser's local-storage quota.
