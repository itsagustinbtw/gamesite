const AD_SCRIPT_HOSTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagmanager.com",
  "google-analytics.com",
  "adservice.google.com",
  "securepubads.g.doubleclick.net",
  "adsystem.com"
];

const AD_CLASS_OR_ID = /(^|[\s_-])(?:ad|ads|advert|advertisement|adslot|adcontainer|adwrapper|adbanner)(?:$|[\s\d_-])/i;

// Wrangler's local file uploader caps individual files at 300 MiB. This game is split
// into two R2 objects and streamed back as one HTML response.
const SPLIT_GAMES = {
  "clrabbithole106.html": ["clrabbithole106.html.part1", "clrabbithole106.html.part2"]
};

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Disposition, ETag, Accept-Ranges",
    "Vary": "Origin"
  };
}

function addAdCleaner(response) {
  const remover = {
    element(element) {
      const id = element.getAttribute("id") || "";
      const classes = element.getAttribute("class") || "";
      const src = (element.getAttribute("src") || element.getAttribute("href") || "").toLowerCase();
      const role = (element.getAttribute("data-ad-slot") || element.getAttribute("data-ad-client") || "");
      if (AD_CLASS_OR_ID.test(`${id} ${classes}`) || role || AD_SCRIPT_HOSTS.some(host => src.includes(host))) {
        element.remove();
      }
    }
  };

  return new HTMLRewriter()
    .on("[id], [class], [data-ad-slot], [data-ad-client]", remover)
    .on("script[src], iframe[src], link[href]", remover)
    .on("ins.adsbygoogle, .ad-container, .ad-wrapper, .ad-banner, .ad-slot, .advertisement, .advertisement-container", remover)
    .on("head", {
      element(element) {
        element.append(
          "<style id=agu-ad-cleanup>.ad-container,.ad-wrapper,.ad-banner,.ad-slot,.advertisement,.advertisement-container,[data-ad-slot],[data-ad-client]{display:none!important;visibility:hidden!important}</style>",
          { html: true }
        );
      }
    })
    .transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request.headers.get("Origin") || "*");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers });
    }
    if (!url.pathname.startsWith("/games/")) {
      return new Response("Not found", { status: 404, headers });
    }

    const chunkRoute = url.pathname.match(/^\/games\/_chunks\/clrabbithole106\/(\d+)$/);
    if (chunkRoute) {
      const chunkNumber = Number(chunkRoute[1]);
      const partKey = SPLIT_GAMES["clrabbithole106.html"]?.[chunkNumber - 1];
      if (!partKey) return new Response("Not found", { status: 404, headers });
      const part = request.method === "HEAD"
        ? await env.GAMES.head(partKey)
        : await env.GAMES.get(partKey);
      if (!part) return new Response("Game not found", { status: 404, headers });
      const partHeaders = new Headers(headers);
      partHeaders.set("Content-Type", "application/octet-stream");
      partHeaders.set("Content-Length", String(part.size));
      partHeaders.set("Cache-Control", "public, max-age=86400");
      if (part.httpEtag || part.etag) partHeaders.set("ETag", part.httpEtag || part.etag);
      return new Response(request.method === "HEAD" ? null : part.body, { headers: partHeaders });
    }

    let key;
    try {
      key = decodeURIComponent(url.pathname.slice("/games/".length));
    } catch {
      return new Response("Invalid game path", { status: 400, headers });
    }
    if (!key || key.split("/").some(part => part === "..")) {
      return new Response("Invalid game path", { status: 400, headers });
    }
    if (/\.part\d+$/i.test(key)) return new Response("Not found", { status: 404, headers });

    const splitParts = SPLIT_GAMES[key];
    if (splitParts && request.method === "GET") {
      const chunkUrls = splitParts.map((_, index) =>
        new URL(`/games/_chunks/clrabbithole106/${index + 1}`, url.origin).href
      );
      const fileName = JSON.stringify(key);
      const isDownload = url.searchParams.get("download") === "1";
      const loader = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${isDownload ? "Preparing download" : "Loading game"}</title><style>html,body{margin:0;width:100%;height:100%;font:16px system-ui;background:#111827;color:#f9fafb}main{box-sizing:border-box;min-height:100%;display:grid;place-content:center;justify-items:center;gap:12px;padding:24px;text-align:center}progress{width:min(360px,80vw);height:16px}button{padding:10px 16px;border:0;border-radius:8px;background:#38bdf8;color:#082f49;font-weight:700;cursor:pointer}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body><main><strong id="status">Loading game data…</strong><progress id="progress"></progress><button id="download" hidden>Save game</button></main><script>(async()=>{const paths=${JSON.stringify(chunkUrls)};const parts=[];const progress=document.querySelector('#progress');const status=document.querySelector('#status');const button=document.querySelector('#download');let loaded=0;let total=0;for(const path of paths){const response=await fetch(path);if(!response.ok)throw new Error('A game file could not be loaded ('+response.status+').');total+=Number(response.headers.get('content-length'))||0;const blob=await response.blob();parts.push(blob);loaded+=blob.size;progress.max=total||1;progress.value=loaded;status.textContent='Loading game data… '+(total?Math.floor(loaded/total*100):0)+'%';}const game=new Blob(parts,{type:'text/html'});const gameUrl=URL.createObjectURL(game);${isDownload ? `status.textContent='Game is ready to save.';button.textContent='Save '+${fileName};button.hidden=false;button.onclick=()=>{const link=document.createElement('a');link.href=gameUrl;link.download=${fileName};link.click();};` : `const frame=document.createElement('iframe');frame.title=${fileName};frame.allow='autoplay; fullscreen; gamepad';frame.allowFullscreen=true;frame.src=gameUrl;document.body.replaceChildren(frame);`}})().catch(error=>{document.querySelector('#status').textContent=error.message;document.querySelector('#progress').hidden=true;});</script></body></html>`;
      const loaderHeaders = new Headers(headers);
      loaderHeaders.set("Content-Type", "text/html; charset=utf-8");
      loaderHeaders.set("Cache-Control", "no-store");
      return new Response(loader, { headers: loaderHeaders });
    }
    let object;
    let splitObjects;
    if (splitParts) {
      splitObjects = await Promise.all(splitParts.map(part => env.GAMES.head(part)));
      if (splitObjects.some(part => !part)) return new Response("Game not found", { status: 404, headers });
      object = {
        size: splitObjects.reduce((total, part) => total + part.size, 0),
        httpEtag: `W/\"${splitObjects.map(part => part.httpEtag || part.etag || "").join("-")}\"`
      };
    } else {
      object = request.method === "HEAD"
        ? await env.GAMES.head(key)
        : await env.GAMES.get(key);
    }
    if (!object) return new Response("Game not found", { status: 404, headers });

    const responseHeaders = new Headers(headers);
    if (object.httpMetadata) object.writeHttpMetadata(responseHeaders);
    responseHeaders.set("ETag", object.httpEtag || object.etag || "");
    responseHeaders.set("Cache-Control", "public, max-age=86400");
    responseHeaders.set("Content-Length", String(object.size));
    if (!responseHeaders.has("Content-Type")) responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    if (url.searchParams.get("download") === "1") {
      const filename = key.split("/").pop().replace(/[\r\n"\\]/g, "_");
      responseHeaders.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    }
    if (request.method === "HEAD") {
      responseHeaders.set("Content-Length", String(object.size));
      return new Response(null, { headers: responseHeaders });
    }

    let response = new Response(object.body, { status: 200, headers: responseHeaders });
    // The split asset contains a huge embedded payload and no known ad hosts; avoid
    // parsing it so HTMLRewriter does not buffer an oversized inline text block.
    if (/\.html?$/i.test(key) && !splitParts) {
      response.headers.delete("Content-Length");
      response = addAdCleaner(response);
    }
    return response;
  }
};
