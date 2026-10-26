import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo, setJsonLd } from '../../utils/seo';
import { ADMIN_BASE } from '../../utils/adminPaths';
import { DELIVERY_BASE } from '../../utils/deliveryPaths';

/** Public pages: title + description shown in Google. */
const PAGES = {
  '/': { title: null, description: null },
  '/shop': { title: 'Shop Gold & Silver Jewellery', description: 'Shop BIS hallmarked 22K & 18K gold and silver jewellery — rings, necklaces, earrings, bangles, bala and gold coins — priced at today\'s live gold rate. M.B. Jewellers, New Barrackpore.' },
  '/about': { title: 'About Us', description: 'M.B. Jewellers, New Barrackpore, Kolkata — crafting hallmarked gold and silver jewellery since 2021.' },
  '/contact': { title: 'Contact & Store Timings', description: 'Visit or call M.B. Jewellers, New Barrackpore, Kolkata. Open Mon–Sun 10:00 AM–1:30 PM and 6:30 PM–9:30 PM (closed Thursday). Phone 09830424257.' },
  '/terms': { title: 'Terms & Conditions' },
  '/terms-and-conditions': { title: 'Terms & Conditions', path: '/terms' },
  '/privacy-policy': { title: 'Privacy Policy' },
  '/privacy': { title: 'Privacy Policy', path: '/privacy-policy' },
  '/diamond-coming-soon': { title: 'Diamond Collection — Coming Soon', noindex: true },
};

/** Private / utility pages: kept out of search results (their own titles are left as they are). */
const PRIVATE_PREFIXES = ['/custom-order', '/cart', '/checkout', '/orders', '/profile', '/custom-orders', '/login', '/register', '/verify', ADMIN_BASE, DELIVERY_BASE];

/**
 * RouteSeo — updates <head> on every navigation (mounted once inside the router).
 * Product pages set their own product-specific tags in ProductDetail.jsx.
 */
export default function RouteSeo() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!pathname.startsWith('/products/')) setJsonLd('product', null);

    if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      document.head.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow');
      return;
    }
    if (pathname.startsWith('/products/')) {
      applySeo({ title: 'Jewellery', path: pathname }); // replaced once the product loads
      return;
    }

    const page = PAGES[pathname];
    if (!page) {
      applySeo({ title: 'Page Not Found', noindex: true });
      return;
    }
    let path = page.path || pathname;
    let { title } = page;
    // Gold / Silver and category views of the shop are their own landing pages
    if (pathname === '/shop') {
      const params = new URLSearchParams(search);
      const material = params.get('material');
      const category = params.get('category');
      if (material === 'Gold' || material === 'Silver') {
        path = `/shop?material=${material}`;
        title = `${material} Jewellery`;
      } else if (category && /^[a-f0-9]{24}$/i.test(category)) {
        path = `/shop?category=${category}`;
      }
    }
    applySeo({ title, description: page.description, path, noindex: !!page.noindex });
  }, [pathname, search]);

  return null;
}
