# AGU Games: edit and publish guide

The main public address is <https://history.mathandscience.workers.dev/>. Its homepage and the `/games/` routes are served by the same Cloudflare Worker. You do not need to configure GitHub Pages to make the site work.

## 1. Open the right folder in VS Code

1. Open VS Code.
2. Choose **File → Open Folder…**.
3. Select `/Users/aguss/Downloads/gamesite`.
4. The live homepage is `index.html`. `MAIN.html` is an old copy; leave it alone.

Important files:

- `index.html` — homepage, game list, game window, colors, and background controls.
- `about.html` and `news.html` — the other site pages.
- `theme-store.js` — shared browser storage for custom backgrounds across pages.
- `cloudflare/worker.js` — game delivery, downloads, and ad-markup cleanup.
- `cloudflare/prepare_site.mjs` — copies the current site pages into the Worker’s static-assets build folder. That folder is generated and ignored by Git.
- `wrangler.toml` — connects the Worker to its static site files and private R2 game bucket.
- `../HTML games/UGS Files/` — the original local game files. They are outside the Git repository; the deployed copies are in R2.

## 2. Preview your changes on your computer

1. Save your changes in VS Code.
2. Double-click `start-local.command`, or open VS Code’s Terminal and run:

   ```sh
   python3 serve_local.py
   ```

3. Open <http://127.0.0.1:8000/>. The local server lets the site load the games from the sibling `HTML games` folder.
4. Try the parts you changed. For theme work, choose a background, change each color, then use **About** and **News** and return Home.
5. Stop the server with **Control+C** in the Terminal when you are done.

Do not preview by double-clicking `index.html`; browsers restrict local files opened with `file://`.

## 3. Publish normal site changes

Cloudflare builds and deploys the Worker whenever you push a change to the `main` branch. The build runs `node cloudflare/prepare_site.mjs` and then deploys with Wrangler. You do not need to upload the generated `cloudflare/site` folder yourself or sign in to Cloudflare for routine edits.

### Using VS Code

1. Open **Source Control** from the left sidebar.
2. Review the changed files and click each diff to check it.
3. Stage the files you meant to change using the **+** next to each file. Do not stage game files or `.wrangler` output.
4. Enter a short commit message, such as `Fix shared background settings`.
5. Click **Commit**, then **Sync Changes** (or **Push**) to send the commit to `main`.
6. In Cloudflare, open **Workers & Pages → history → Builds** and wait for the newest build to finish successfully.
7. Refresh <https://history.mathandscience.workers.dev/> and check your change.

### Using Terminal

From the `gamesite` folder, review and publish the files you changed:

```sh
git status
git diff
git add index.html about.html news.html theme-store.js
git commit -m "Describe the change"
git push origin main
```

Change the `git add` list to match your edits. For example, include `cloudflare/worker.js`, `wrangler.toml`, or `cloudflare/prepare_site.mjs` only when you changed those files. Include new images or scripts that the site needs.

The GitHub Pages workflow may also update its old mirror, but the Cloudflare Worker URL is the main site. Pushing code does not update the optional `agu-games-site.pages.dev` backup; that Pages project uses Direct Upload.

## 4. Add a game

1. Put the game's `.html` file in the sibling folder `../HTML games/UGS Files/`.
2. Open `index.html` and add the exact filename to the `localGameFiles` list. Keep the spelling and capitalization the same as the file.
3. From the `gamesite` folder, upload that game to the private R2 bucket:

   ```sh
   python3 upload_games_to_r2.py --only "New Game.html"
   ```

4. Preview the homepage and launch the new game locally. Then publish the `index.html` change using the steps above.

The uploader handles regular HTML files with Wrangler. Files over 300 MiB require the short-lived, bucket-only S3 credentials described in `README.md`. Never commit or paste those credentials into a source file.

## 5. Test and publish theme changes

Use <https://history.mathandscience.workers.dev/> for the primary site. The colors, background image, blur, and Halloween setting are saved in this browser’s local storage and IndexedDB. They are shared between Home, About, and News on the same site address. The `agu-games-site.pages.dev` backup is a different web address, so browsers keep its theme settings separately.

For a background or palette change, preview it locally, navigate between all three pages, and refresh once. Then commit and push the files you changed. The Worker build automatically includes `theme-store.js` with the pages.

## 6. If a publish fails or you need to undo a change

1. Open **Workers & Pages → history → Builds** and select the failed build to read the error.
2. Fix the error locally and run the preview again.
3. Commit and push the correction; Cloudflare starts a new build.
4. To undo a published code change safely, use VS Code Source Control to revert its commit, or run `git revert <commit-id>` and push the revert. This keeps a record and triggers a fresh deployment.

The primary site is <https://history.mathandscience.workers.dev/>. A direct-upload backup is <https://agu-games-site.pages.dev/>.
