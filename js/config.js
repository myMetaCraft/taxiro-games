// Site configuration. Public values only — never put secrets here.
window.MC_CONFIG = {
  // TODO(owner): NEEDS THE OWNER'S REAL PARTNER EMAIL before publishing. Intentionally left empty —
  // do not invent one. While empty, the site shows "Partner email coming soon" and no mailto link.
  contactEmail: "",
  // Demo RGS (math runs only there). Railway domain for now; switch to https://rgs.taxiro.ai once DNS exists.
  rgsBaseUrl: "https://web-production-69a86.up.railway.app",
  // Origins where this site itself is served. These must be in the demo RGS ALLOWED_ORIGINS (CORS);
  // they are not used for iframe checks.
  siteOrigins: ["https://games.taxiro.ai", "https://mymetacraft.github.io"],
  // Allowed iframe origins for game demos. A game's embedUrl is https://<rgs>/launch/<id>, so the RGS
  // origin must be listed. When the game host exists (e.g. https://play.taxiro.ai), add it here as well
  // AND to the frame-src CSP in index.html / play.html (the RGS redirects the iframe there).
  allowedEmbedOrigins: [
    "https://web-production-69a86.up.railway.app",
    "https://games.taxiro.ai",
    "https://mymetacraft.github.io"
  ],
  rtpPolicy: { min: 96.0, max: 96.7 }
};
