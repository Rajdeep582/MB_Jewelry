/**
 * seo.js — per-page <head> tags for a single-page app.
 * index.html holds the defaults; each route updates title, description, canonical URL,
 * robots and social-preview tags here (Google renders JavaScript, and WhatsApp/Facebook use
 * the defaults from index.html).
 */
export const SITE_URL = 'https://mbjewellers.store';
export const SITE_NAME = 'M.B. Jewellers';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
export const DEFAULT_DESCRIPTION =
  'M.B. Jewellers, New Barrackpore (Kolkata): BIS hallmarked 22K & 18K gold and silver jewellery, live gold-rate pricing and custom designs. Delivery to New Barrackpore, Madhyamgram and Barasat.';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Page-level structured data (e.g. Product). Pass null to remove. */
export function setJsonLd(id, data) {
  const elId = `jsonld-${id}`;
  document.getElementById(elId)?.remove();
  if (!data) return;
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.id = elId;
  s.textContent = JSON.stringify(data);
  document.head.appendChild(s);
}

/**
 * applySeo — set the tags for the current page.
 * @param {object} o
 * @param {string} [o.title]       page title (brand is appended)
 * @param {string} [o.description]
 * @param {string} [o.path]        canonical path, e.g. '/shop' (default: current path)
 * @param {string} [o.image]       absolute image URL for previews
 * @param {boolean} [o.noindex]    keep this page out of search engines
 */
export function applySeo({ title, description, path, image, noindex = false } = {}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — BIS Hallmarked Gold & Silver Jewellery | New Barrackpore, Kolkata`;
  const url = `${SITE_URL}${path ?? globalThis.location?.pathname ?? '/'}`;
  const desc = (description || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 300);

  document.title = fullTitle;
  setMeta('name', 'description', desc);
  setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
  setCanonical(url);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image || DEFAULT_IMAGE);
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', image || DEFAULT_IMAGE);
}
