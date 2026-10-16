/**
 * Pages that show the floating Back arrow — only "drill-down" pages a visitor opens FROM
 * another page and returns from (a single product, checkout from the cart, the legal pages
 * opened from the footer). Main pages (home, shop/gold/silver, about, contact, cart, custom
 * jewellery, account pages, login/register) don't get one. Order detail pages already have
 * their own "Back to My Orders" link.
 */
const BACK_ROUTES = [
  /^\/products\/[^/]+\/?$/,
  /^\/checkout\/?$/,
  /^\/terms(-and-conditions)?\/?$/,
  /^\/privacy(-policy)?\/?$/,
];

export const hasBackButton = (pathname) => BACK_ROUTES.some((re) => re.test(pathname));
