/**
 * sitemap.js — GET /api/sitemap.xml
 * Served to Google as https://mbjewellers.store/sitemap.xml (Netlify proxies it, see
 * frontend/public/_redirects). Built from live data, so new products appear automatically.
 * Includes public pages, Gold / Silver / category views of the shop and every product
 * (Diamond excluded while that collection is disabled). Cached for 1 hour.
 */
const Product = require('../models/Product');
const Category = require('../models/Category');
const logger = require('./logger');

const SITE_URL = (process.env.SITE_URL || 'https://mbjewellers.store').replace(/\/+$/, '');
const MAX_PRODUCTS = 5000;
const CACHE_MS = 60 * 60 * 1000;

const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/shop?material=Gold', changefreq: 'daily', priority: '0.8' },
  { path: '/shop?material=Silver', changefreq: 'daily', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.2' },
];

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

function urlEntry({ path, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(SITE_URL + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n');
}

async function buildSitemap() {
  const [products, categories] = await Promise.all([
    Product.find({ material: { $ne: 'Diamond' } }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(MAX_PRODUCTS).lean(),
    Category.find({ isActive: { $ne: false } }).select('_id updatedAt').lean(),
  ]);
  const newest = day(products[0]?.updatedAt);
  const entries = [
    ...STATIC_PAGES.map((p) => urlEntry({ ...p, lastmod: p.path.startsWith('/shop') || p.path === '/' ? newest : undefined })),
    ...categories.map((c) => urlEntry({ path: `/shop?category=${c._id}`, lastmod: day(c.updatedAt), changefreq: 'weekly', priority: '0.7' })),
    ...products.map((p) => urlEntry({ path: `/products/${p._id}`, lastmod: day(p.updatedAt), changefreq: 'weekly', priority: '0.8' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

let cache = { xml: '', at: 0 };

const sitemapHandler = async (req, res) => {
  try {
    if (!cache.xml || Date.now() - cache.at > CACHE_MS) cache = { xml: await buildSitemap(), at: Date.now() };
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(cache.xml);
  } catch (err) {
    logger.error(`Sitemap build failed: ${err.message}`);
    res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
  }
};

/** Test helper: forget the cached sitemap. */
const resetSitemapCache = () => { cache = { xml: '', at: 0 }; };

module.exports = { sitemapHandler, buildSitemap, resetSitemapCache };
