import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiEdit3, FiTrash2, FiSearch, FiX, FiUpload, FiImage, FiAlertCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiStar } from 'react-icons/fi';
import { productService, categoryService, adminService } from '../../services/services';
import { formatPrice, resolveImageUrl } from '../../utils/helpers';
import toast from 'react-hot-toast';

const MATERIALS = ['Gold', 'Silver', 'Diamond'];

// Purity options per material (all dynamic-pricing compatible)
const PURITY_OPTIONS = {
  Gold: ['22K', '18K'],
  Silver: ['Normal', 'Hallmarked'],
  Diamond: ['22K', '18K', '14K'],
};

function DetailItem({ label, value, mono, gold, highlight }) {
  return (
    <div>
      <p className="text-dark-500 uppercase tracking-wide text-[10px]">{label}</p>
      <p className={`mt-0.5 text-xs font-medium truncate ${
        gold ? 'text-gold-400' : highlight ? 'text-blue-400' : mono ? 'text-dark-300 font-mono' : 'text-dark-200'
      }`}>
        {value}
      </p>
    </div>
  );
}

const formatDate = (dateStr) =>
  dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function ProductForm({ product, categories, onClose, onSaved }) {
  const validMaterials = ['Gold', 'Silver', 'Diamond'];
  const initialMaterial = validMaterials.includes(product?.material) ? product.material : 'Gold';
  const purityOpts = PURITY_OPTIONS[initialMaterial] || [];
  const initialPurity = purityOpts.includes(product?.purity) ? product.purity : purityOpts[0] || '';
  const initialUnit = product?.unit === 'kg' ? 'kg' : 'gram';

  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    material: initialMaterial,
    category: product?.category?._id || '',
    stock: product?.stock ?? 0,
    isFeatured: product?.isFeatured || false,
    purity: initialPurity,
    weightValue: product?.weightValue || '',
    unit: initialUnit,
    makingCharges: product?.makingCharges ?? 12,
    gst: product?.gst ?? 3,
  });

  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [replaceImages, setReplaceImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => filePreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [filePreviews]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    const previews = selected.map((f) => URL.createObjectURL(f));
    setFilePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return previews;
    });
    if (selected.length > 0 && product) setReplaceImages(true);
  };

  const clearNewFiles = () => {
    filePreviews.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setFilePreviews([]);
    setReplaceImages(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMaterialChange = (mat) => {
    const opts = PURITY_OPTIONS[mat] || [];
    setForm({ ...form, material: mat, purity: opts[0] || '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) { toast.error('Please select a category'); return; }
    if (!form.purity) { toast.error('Please select a purity'); return; }
    if (!form.weightValue || Number(form.weightValue) <= 0) {
      toast.error('Enter a valid weight value');
      return;
    }
    setSaving(true);

    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('weightValue', form.weightValue);
    fd.append('unit', form.unit);
    fd.append('category', form.category);
    fd.append('material', form.material);
    fd.append('purity', form.purity);
    fd.append('stock', form.stock);
    fd.append('isFeatured', form.isFeatured);
    fd.append('makingCharges', form.makingCharges);
    fd.append('gst', form.gst);
    fd.append('tags', JSON.stringify([]));

    files.forEach((f) => fd.append('images', f));
    if (product && replaceImages) fd.append('replaceImages', 'true');

    try {
      if (product) {
        await productService.updateProduct(product._id, fd);
        toast.success('Product updated!');
      } else {
        await productService.createProduct(fd);
        toast.success('Product created!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const existingImages = product?.images || [];
  const currentPurities = PURITY_OPTIONS[form.material] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto overscroll-contain glass rounded-2xl p-5 sm:p-6" data-lenis-prevent="true"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">{product ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="p-1.5 text-dark-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"><FiX /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Description */}
          <div>
            <label className="label-dark">Product Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" required />
          </div>
          <div>
            <label className="label-dark">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input-dark resize-none" required />
          </div>

          {/* Weight / Unit / Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label-dark">Weight Value *</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={form.weightValue}
                onChange={(e) => setForm({ ...form, weightValue: e.target.value })}
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 5.5"
                className="input-dark"
                required
              />
            </div>
            <div>
              <label className="label-dark">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-dark">
                <option value="gram">Per Gram</option>
                <option value="kg">Per KG</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label-dark">Stock *</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} onWheel={(e) => e.target.blur()} className="input-dark" required />
            </div>
          </div>

          <p className="text-xs text-dark-500 -mt-2">Price is auto-calculated from weight × live rate (set in Pricing &amp; Discounts)</p>

          {/* Material / Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-dark">Material *</label>
              <select value={form.material} onChange={(e) => handleMaterialChange(e.target.value)} className="input-dark">
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-dark">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-dark" required>
                <option value="">Select...</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Metal Specifications — Purity + Charges */}
          <div className="bg-dark-900 border border-gold-500/20 p-3 rounded-lg space-y-3">
            <p className="text-xs text-gold-500 uppercase tracking-wider">Metal Specifications</p>
            <div>
              <label className="label-dark">Purity *</label>
              <select
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
                className="input-dark"
                required
              >
                {currentPurities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="label-dark">Making Charges (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.makingCharges}
                  onChange={(e) => setForm({ ...form, makingCharges: e.target.value })}
                  onWheel={(e) => e.target.blur()}
                  className="input-dark"
                />
              </div>
              <div>
                <label className="label-dark">GST (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.gst}
                  onChange={(e) => setForm({ ...form, gst: e.target.value })}
                  onWheel={(e) => e.target.blur()}
                  className="input-dark"
                />
              </div>
            </div>
            <p className="text-xs text-dark-600">Defaults: 12% making charges, 3% GST. Override per product if needed.</p>
          </div>

          {/* Featured */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="featured" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="accent-gold-500" />
            <label htmlFor="featured" className="text-sm text-dark-400 cursor-pointer">Mark as Featured</label>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <label className="label-dark">Images</label>

            {product && existingImages.length > 0 && filePreviews.length === 0 && (
              <div>
                <p className="text-xs text-dark-500 mb-1.5 flex items-center gap-1"><FiImage size={11}/> Current images ({existingImages.length})</p>
                <div className="flex gap-2 flex-wrap">
                  {existingImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-dark-800 flex-shrink-0">
                      <img src={resolveImageUrl(img.url)} alt="" className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display='none'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filePreviews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-gold-500 flex items-center gap-1"><FiUpload size={11}/> {filePreviews.length} new image(s) — will {replaceImages ? 'replace all' : 'be added'}</p>
                  <button type="button" onClick={clearNewFiles} className="text-xs text-dark-500 hover:text-red-400 transition-colors flex items-center gap-1"><FiX size={11}/> Clear</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {filePreviews.map((src, idx) => (
                    <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border border-gold-500/30 bg-dark-800 flex-shrink-0">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {product && filePreviews.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-dark-400 cursor-pointer">
                <input type="checkbox" className="accent-gold-500" checked={replaceImages} onChange={(e) => setReplaceImages(e.target.checked)} />
                Replace all existing images with new ones
              </label>
            )}

            <label className="flex items-center gap-2 input-dark cursor-pointer hover:border-gold-500/50 transition-colors group">
              <FiUpload size={14} className="text-dark-400 group-hover:text-gold-400 transition-colors" />
              <span className="text-dark-400 text-sm group-hover:text-dark-300 transition-colors">
                {files.length > 0 ? `${files.length} file(s) selected` : 'Choose images (max 6, 5MB each)'}
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5 disabled:opacity-60">
              {saving ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Gold', label: 'Gold' },
  { key: 'Silver', label: 'Silver' },
  { key: 'featured', label: 'Featured' },
];

function filterParams(filter) {
  if (filter === 'Gold' || filter === 'Silver') return { material: filter };
  if (filter === 'featured') return { featured: 'true' };
  return {};
}

function ProductThumb({ p, className = 'w-11 h-11' }) {
  const [broken, setBroken] = useState(false);
  const url = p.images?.[0]?.url;
  return (
    <div className={`${className} relative rounded-lg overflow-hidden bg-dark-800 border border-white/[0.08] flex-shrink-0 flex items-center justify-center`}>
      {url && !broken ? (
        <img src={resolveImageUrl(url)} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <FiImage size={14} className="text-dark-600" />
      )}
      {p.images?.length > 1 && (
        <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[9px] leading-tight text-dark-200">{p.images.length}</span>
      )}
    </div>
  );
}

function StockBadge({ stock }) {
  if (stock === 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">Out of stock</span>;
  }
  if (stock <= 5) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 whitespace-nowrap">Low · {stock}</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">{stock} in stock</span>;
}

function FeaturedMark({ on }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold-400" title="Featured">
      <FiStar size={12} className="fill-gold-400" /> Featured
    </span>
  ) : (
    <span className="text-dark-600 text-xs">—</span>
  );
}

function ProductDetails({ p, getGlobalRate }) {
  const { entry: rate, effectiveUnit } = getGlobalRate(p.material, p.purity, p.unit || 'gram');
  // Product-level values take priority; fall back to global rate defaults
  const mc = p.makingCharges != null ? p.makingCharges : rate?.makingCharges;
  const gst = p.gst != null ? p.gst : rate?.gst;
  return (
    <div className="bg-dark-900/80 border border-white/[0.08] rounded-xl p-4">
      {/* Identification */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-3">
        <DetailItem label="Product ID" value={p.productId || '—'} mono />
        <DetailItem label="Category" value={p.category?.name || '—'} />
        <DetailItem label="Created" value={formatDate(p.createdAt)} />
      </div>

      <div className="border-t border-white/[0.08] pt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mb-3">
        <DetailItem label="Material" value={p.material} />
        <DetailItem label="Purity" value={p.purity || '—'} />
        <DetailItem label="Weight" value={p.weightValue ? `${p.weightValue} ${p.unit || 'g'}` : '—'} />
        <DetailItem label="Stock" value={p.stock} />
        <DetailItem label="Sold" value={p.sold ?? 0} />
        <DetailItem label="Rating" value={p.numReviews > 0 ? `${p.averageRating} ★ (${p.numReviews})` : 'No reviews'} />
      </div>

      {/* Pricing */}
      <div className="border-t border-white/[0.08] pt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        <DetailItem label="Making Charges" value={mc != null ? `${mc}%` : '—'} />
        <DetailItem label="GST" value={gst != null ? `${gst}%` : '—'} />
        <DetailItem label="Live Rate" value={rate ? `₹${Number(rate.livePrice).toLocaleString('en-IN')} / ${effectiveUnit}` : '—'} />
        <DetailItem label="Current Price" value={formatPrice(p.discountedPrice || p.price)} gold />
        {p.discountedPrice && <DetailItem label="Base Price" value={formatPrice(p.price)} />}
      </div>

      {/* Tags */}
      {p.tags?.length > 0 && (
        <div className="border-t border-white/[0.08] pt-3 mt-3">
          <p className="text-dark-500 uppercase tracking-wide text-[10px] mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <span key={tag} className="text-xs bg-dark-800 text-dark-400 border border-white/10 rounded px-2 py-0.5">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceCell({ p }) {
  // Price 0 = no global rate for this material/purity yet
  if (!(p.discountedPrice || p.price)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-300" title="Set a rate in Pricing & Discounts">
        <FiAlertCircle size={12} /> No live rate
      </span>
    );
  }
  return (
    <div className="leading-tight">
      <p className="text-gold-400 text-sm font-semibold tabular-nums">{formatPrice(p.discountedPrice || p.price)}</p>
      {p.discountedPrice && <p className="text-dark-500 text-[11px] line-through tabular-nums">{formatPrice(p.price)}</p>}
    </div>
  );
}

const iconBtn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg text-dark-400 transition-colors';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [expandedId, setExpandedId] = useState(null);
  const [globalPricingData, setGlobalPricingData] = useState([]);

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  // Tries exact unit match first, then falls back to the opposite unit (gram↔kg)
  const getGlobalRate = (material, purity, unit) => {
    const exact = globalPricingData.find(
      (g) => g.material === material && g.purity === purity && g.unit === unit
    );
    if (exact) return { entry: exact, effectiveUnit: unit };
    const otherUnit = unit === 'gram' ? 'kg' : 'gram';
    const other = globalPricingData.find(
      (g) => g.material === material && g.purity === purity && g.unit === otherUnit
    );
    if (other) return { entry: other, effectiveUnit: otherUnit };
    return { entry: null, effectiveUnit: unit };
  };

  useEffect(() => { document.title = 'Products — Admin'; }, []);

  // Debounce typing so each keystroke doesn't fire a request
  useEffect(() => {
    const t = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadData = useCallback(async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, catRes, pricingRes] = await Promise.all([
        productService.getProducts({ search: search.trim() || undefined, page: currentPage, limit: 20, ...filterParams(filter) }),
        categoryService.getCategories(),
        adminService.getGlobalPricing(),
      ]);
      setProducts(prodRes.data.products);
      setPagination(prodRes.data.pagination);
      setCategories(catRes.data.categories);
      setGlobalPricingData(pricingRes.data.pricing);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, page, filter]);

  useEffect(() => {
    setPage(1);
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  useEffect(() => {
    loadData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await productService.deleteProduct(id);
      toast.success('Product deleted');
      loadData(page);
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const openCreate = () => { setEditProduct(null); setShowForm(true); };
  const openEdit = (p) => { setEditProduct(p); setShowForm(true); };

  const outCount = products.filter((p) => p.stock === 0).length;
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const rangeStart = pagination.total === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, pagination.total);
  const emptyText = search
    ? `No products matching "${search}"`
    : filter !== 'all' ? 'No products in this filter.' : 'No products yet. Add one!';

  const onKeyToggle = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(id); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-white">Products</h1>
          <p className="text-dark-400 text-sm mt-0.5">
            {pagination.total} {filter === 'all' ? 'total' : FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} product{pagination.total === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={openCreate} className="btn-gold text-sm gap-2">
          <FiPlus size={14} /> Add Product
        </button>
      </div>

      <div className="card p-3 sm:p-4">
        {/* Search + filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <div className="relative flex-1">
            <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by name, tag, description..."
              className="input-dark pl-9 pr-9 text-sm focus:border-gold-500/50"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-dark-400 hover:text-white hover:bg-white/5">
                <FiX size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" role="group" aria-label="Filter products">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                  filter === f.key
                    ? 'bg-gold-500/15 text-gold-300 border-gold-500/40'
                    : 'bg-dark-800/60 text-dark-400 border-white/[0.08] hover:text-white hover:border-white/20'
                }`}
              >
                {f.key === 'featured' && <FiStar size={11} className={`inline -mt-0.5 mr-1 ${filter === f.key ? 'fill-gold-400' : ''}`} />}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory hints for the visible page */}
        {!loading && (outCount > 0 || lowCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-dark-400">
            <span className="uppercase tracking-wider text-dark-500">This page</span>
            {outCount > 0 && <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">{outCount} out of stock</span>}
            {lowCount > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">{lowCount} low stock</span>}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm">
            <FiAlertCircle size={16} /> {error}
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-dark-500 text-[11px] uppercase tracking-wider">
                <th className="text-left font-medium py-2.5 pl-2 pr-4">Product</th>
                <th className="text-left font-medium py-2.5 pr-4">Category</th>
                <th className="text-left font-medium py-2.5 pr-4">Price</th>
                <th className="text-left font-medium py-2.5 pr-4">Stock</th>
                <th className="text-left font-medium py-2.5 pr-4">Featured</th>
                <th className="text-right font-medium py-2.5 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="py-2.5"><div className="skeleton h-11 rounded-lg" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-dark-500">{emptyText}</td>
                </tr>
              ) : products.map((p) => {
                const open = expandedId === p._id;
                return (
                  <Fragment key={p._id}>
                    <tr
                      onClick={() => toggleExpand(p._id)}
                      onKeyDown={(e) => onKeyToggle(e, p._id)}
                      tabIndex={0}
                      aria-expanded={open}
                      className={`group cursor-pointer transition-colors outline-none focus-visible:bg-white/[0.04] ${open ? 'bg-white/[0.03]' : 'hover:bg-white/[0.025]'}`}
                    >
                      <td className="py-2.5 pl-2 pr-4">
                        <div className="flex items-center gap-3">
                          <ProductThumb p={p} />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium max-w-[150px] lg:max-w-[260px] xl:max-w-[340px] truncate group-hover:text-gold-200 transition-colors" title={p.name}>{p.name}</p>
                            <p className="text-dark-500 text-xs mt-0.5">
                              {p.material} · {p.purity || '—'}{p.weightValue ? ` · ${p.weightValue} ${p.unit || 'g'}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-dark-300 text-xs">{p.category?.name || '—'}</td>
                      <td className="py-2.5 pr-4"><PriceCell p={p} /></td>
                      <td className="py-2.5 pr-4"><StockBadge stock={p.stock} /></td>
                      <td className="py-2.5 pr-4"><FeaturedMark on={p.isFeatured} /></td>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className={`${iconBtn} hover:text-gold-400 hover:bg-gold-500/10`} title="Edit" aria-label={`Edit ${p.name}`}>
                            <FiEdit3 size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(p._id, p.name); }} className={`${iconBtn} hover:text-red-400 hover:bg-red-500/10`} title="Delete" aria-label={`Delete ${p.name}`}>
                            <FiTrash2 size={14} />
                          </button>
                          <span className={`${iconBtn} text-dark-500`} aria-hidden="true">
                            <FiChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180 text-gold-400' : ''}`} />
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    <AnimatePresence>
                      {open && (
                        <motion.tr
                          key="details"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="bg-white/[0.03]"
                        >
                          <td colSpan={6} className="pt-0 pb-3 px-2">
                            <ProductDetails p={p} getGlobalRate={getGlobalRate} />
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2.5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-[104px] rounded-xl" />)
          ) : products.length === 0 ? (
            <p className="py-12 text-center text-dark-500 text-sm">{emptyText}</p>
          ) : products.map((p) => {
            const open = expandedId === p._id;
            return (
              <div key={p._id} className={`rounded-xl border overflow-hidden transition-colors ${open ? 'border-gold-500/30 bg-white/[0.03]' : 'border-white/[0.08] bg-white/[0.015]'}`}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggleExpand(p._id)}
                  onKeyDown={(e) => onKeyToggle(e, p._id)}
                  className="flex gap-3 p-3 outline-none active:bg-white/[0.03]"
                >
                  <ProductThumb p={p} className="w-14 h-14" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-sm font-medium leading-snug line-clamp-1">{p.name}</p>
                      {p.isFeatured && <FiStar size={13} className="text-gold-400 fill-gold-400 flex-shrink-0 mt-0.5" aria-label="Featured" />}
                    </div>
                    <p className="text-dark-500 text-xs mt-0.5 truncate">
                      {p.material} · {p.purity || '—'}{p.category?.name ? ` · ${p.category.name}` : ''}
                    </p>
                    <div className="flex items-end justify-between gap-2 mt-1.5">
                      <PriceCell p={p} />
                      <StockBadge stock={p.stock} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 border-t border-white/5 text-xs font-medium">
                  <button onClick={() => openEdit(p)} className="flex items-center justify-center gap-1.5 py-2.5 text-dark-300 hover:text-gold-400 active:bg-white/[0.04]">
                    <FiEdit3 size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(p._id, p.name)} className="flex items-center justify-center gap-1.5 py-2.5 text-dark-300 hover:text-red-400 border-x border-white/5 active:bg-white/[0.04]">
                    <FiTrash2 size={13} /> Delete
                  </button>
                  <button onClick={() => toggleExpand(p._id)} aria-expanded={open} className={`flex items-center justify-center gap-1.5 py-2.5 active:bg-white/[0.04] ${open ? 'text-gold-400' : 'text-dark-300'}`}>
                    Details <FiChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-2.5 pt-0">
                        <ProductDetails p={p} getGlobalRate={getGlobalRate} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-white/5">
            <p className="text-xs text-dark-500 tabular-nums">Showing {rangeStart}–{rangeEnd} of {pagination.total}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page"
                className="h-8 px-2.5 inline-flex items-center rounded-lg text-xs bg-dark-800 text-dark-400 hover:text-white border border-white/10 disabled:opacity-40 disabled:hover:text-dark-400">
                <FiChevronLeft size={14} />
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).slice(
                Math.max(0, page - 3), Math.min(pagination.pages, page + 2)
              ).map((p) => (
                <button key={p} onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined}
                  className={`w-8 h-8 rounded-lg text-xs tabular-nums transition-colors ${p === page ? 'bg-gold-500 text-dark-900 font-semibold' : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} aria-label="Next page"
                className="h-8 px-2.5 inline-flex items-center rounded-lg text-xs bg-dark-800 text-dark-400 hover:text-white border border-white/10 disabled:opacity-40 disabled:hover:text-dark-400">
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ProductForm
            product={editProduct}
            categories={categories}
            onClose={() => setShowForm(false)}
            onSaved={() => loadData(page)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
