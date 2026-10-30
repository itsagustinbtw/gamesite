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

    let key;
    try {
      key = decodeURIComponent(url.pathname.slice("/games/".length));
    } catch {
      return new Response("Invalid game path", { status: 400, headers });
    }
    if (!key || key.split("/").some(part => part === "..")) {
      return new Response("Invalid game path", { status: 400, headers });
    }

    const object = request.method === "HEAD"
      ? await env.GAMES.head(key)
      : await env.GAMES.get(key);
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
    if (/\.html?$/i.test(key)) response = addAdCleaner(response);
    return response;
  }
};
