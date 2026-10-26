/**
 * xssSanitize — replacement for the deprecated `xss-clean` package, with the SAME effect on data:
 * every "<" in string values of req.body / req.query / req.params becomes "&lt;", so text saved
 * from a request can never open an HTML tag. (Kept identical on purpose: existing data and
 * passwords were stored this way.)
 *
 * Better than xss-clean:
 *   • walks objects instead of JSON.stringify → JSON.parse (no type changes, Buffers untouched)
 *   • edits req.query in place (Express 5 makes req.query read-only)
 *   • depth-limited, so a deeply nested body cannot exhaust the stack
 */
const MAX_DEPTH = 20;

const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

function clean(value, depth = 0) {
  if (typeof value === 'string') return value.replace(/</g, '&lt;');
  if (depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = clean(value[i], depth + 1);
    return value;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) value[key] = clean(value[key], depth + 1);
  }
  return value;
}

function xssSanitize() {
  return (req, res, next) => {
    if (req.body) req.body = clean(req.body);
    if (req.query) clean(req.query);
    if (req.params) clean(req.params);
    next();
  };
}

module.exports = { xssSanitize, clean };
