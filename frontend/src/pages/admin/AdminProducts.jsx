import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiEdit3, FiTrash2, FiSearch, FiX, FiUpload, FiImage, FiAlertCircle } from 'react-icons/fi';
import { productService, categoryService } from '../../services/services';
import { formatPrice, resolveImageUrl } from '../../utils/helpers';
import toast from 'react-hot-toast';

const MATERIALS = ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'];
const TYPES = ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle', 'Brooch', 'Set'];

function ProductForm({ product, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    material: product?.material || 'Gold',
    type: product?.type || 'Ring',
    category: product?.category?._id || '',
    stock: product?.stock ?? 0,
    isFeatured: product?.isFeatured || false,
    weight: product?.weight || '',
    sku: product?.sku || '',
    purity: product?.purity || 'None',
    isHallmarked: product?.isHallmarked || false,
  });

  // Track discount as %, derive discountedPrice
  const initDiscountPct = product?.discountedPrice && product?.price
    ? Math.round((1 - (product.discountedPrice / product.price)) * 100)
    : 0;
  const [discountPercent, setDiscountPercent] = useState(initDiscountPct);
  const [discountedPriceVal, setDiscountedPriceVal] = useState(product?.discountedPrice || '');

  // New files user selected
  const [files, setFiles] = useState([]);
  // Preview URLs for newly selected files
  const [filePreviews, setFilePreviews] = useState([]);
  // Should replace existing images when saving
  const [replaceImages, setReplaceImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => filePreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [filePreviews]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    // Build object URL previews
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

  const handlePriceChange = (e) => {
    const newPrice = Number(e.target.value);
    const newDiscVal = discountPercent > 0 ? Math.round(newPrice - newPrice * (discountPercent / 100)) : '';
    setForm({ ...form, price: e.target.value });
    setDiscountedPriceVal(newDiscVal);
  };

  const handleDiscountPctChange = (e) => {
    const pct = Math.min(99, Math.max(0, Number(e.target.value)));
    setDiscountPercent(pct);
    setDiscountedPriceVal(pct > 0 ? Math.round(Number(form.price) - Number(form.price) * (pct / 100)) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) { toast.error('Please select a category'); return; }
    setSaving(true);

    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('price', form.price);
    fd.append('discountedPrice', discountedPriceVal !== '' ? discountedPriceVal : '');
    fd.append('category', form.category);
    fd.append('material', form.material);
    fd.append('type', form.type);
    fd.append('stock', form.stock);
    fd.append('isFeatured', form.isFeatured);
    fd.append('weight', form.weight);
    fd.append('sku', form.sku);
    fd.append('purity', form.purity);
    fd.append('isHallmarked', form.isHallmarked);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto glass rounded-2xl p-6"
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

          {/* Price / Discount / Stock */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-dark">Price (₹) *</label>
              <input type="number" min="0" value={form.price} onChange={handlePriceChange} className="input-dark" required />
            </div>
            <div>
              <label className="label-dark">Discount (%)</label>
              <input type="number" min="0" max="99" placeholder="0" value={discountPercent || ''} onChange={handleDiscountPctChange} className="input-dark" />
              {discountedPriceVal !== '' && (
                <p className="text-xs text-gold-500 mt-1">Final: ₹{discountedPriceVal}</p>
              )}
            </div>
            <div>
              <label className="label-dark">Stock *</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-dark" required />
            </div>
          </div>

          {/* Material / Type / Category */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-dark">Material *</label>
              <select value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value, purity: 'None' })} className="input-dark">
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-dark">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-dark">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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

          {/* Weight / SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-dark">Weight (e.g. 12.5g)</label>
              <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 5.5g" className="input-dark" />
            </div>
            <div>
              <label className="label-dark">SKU (optional, unique)</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. GLD-RNG-001" className="input-dark" />
            </div>
          </div>

          {/* Featured checkbox */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="featured" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="accent-gold-500" />
            <label htmlFor="featured" className="text-sm text-dark-400 cursor-pointer">Mark as Featured</label>
          </div>

          {/* Metal specs (Gold / Silver only) */}
          {(form.material === 'Gold' || form.material === 'Silver') && (
            <div className="bg-dark-900 border border-gold-500/20 p-3 rounded-lg space-y-3">
              <p className="text-xs text-gold-500 uppercase tracking-wider">Metal Specifications</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-dark">Purity</label>
                  <select value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} className="input-dark">
                    <option value="None">None</option>
                    <option value="22K">22K</option>
                    <option value="24K">24K</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="hallmarked" checked={form.isHallmarked} onChange={(e) => setForm({ ...form, isHallmarked: e.target.checked })} className="accent-gold-500" />
                    <label htmlFor="hallmarked" className="text-sm text-dark-400 cursor-pointer">Hallmark Certified</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image section */}
          <div className="space-y-2">
            <label className="label-dark">Images</label>

            {/* Existing images (edit mode) */}
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

            {/* New file previews */}
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

            {/* Replace toggle (only when editing and files selected) */}
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

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => { document.title = 'Products — Admin'; }, []);

  const loadData = useCallback(async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, catRes] = await Promise.all([
        productService.getProducts({ search: search.trim() || undefined, page: currentPage, limit: 20 }),
        categoryService.getCategories(),
      ]);
      setProducts(prodRes.data.products);
      setPagination(prodRes.data.pagination);
      setCategories(catRes.data.categories);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  // When search changes, reset to page 1
  useEffect(() => {
    setPage(1);
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // When page changes (but NOT on search change — handled above)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">Products</h1>
          <p className="text-dark-400 text-sm">{pagination.total} total products</p>
        </div>
        <button onClick={openCreate} className="btn-gold text-sm gap-2">
          <FiPlus size={14} /> Add Product
        </button>
      </div>

      <div className="card p-4">
        {/* Search */}
        <div className="relative mb-4">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, tag, description..."
            className="input-dark pl-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white">
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm">
            <FiAlertCircle size={16} /> {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-dark-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">Product</th>
                <th className="text-left py-2 pr-4">Category</th>
                <th className="text-left py-2 pr-4">Price</th>
                <th className="text-left py-2 pr-4">Stock</th>
                <th className="text-left py-2 pr-4">Featured</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="py-3"><div className="skeleton h-8 rounded-lg" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-dark-500">
                    {search ? `No products matching "${search}"` : 'No products yet. Add one!'}
                  </td>
                </tr>
              ) : products.map((p) => (
                <tr key={p._id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0 flex items-center justify-center">
                        {p.images?.[0]?.url ? (
                          <img
                            src={resolveImageUrl(p.images[0].url)} alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <span className="text-dark-600 text-xs hidden items-center justify-center w-full h-full"><FiImage /></span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium max-w-[160px] truncate">{p.name}</p>
                        <p className="text-dark-500 text-xs">{p.material} · {p.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-dark-400 text-xs">{p.category?.name || '—'}</td>
                  <td className="py-3 pr-4">
                    <p className="text-gold-500 text-sm">{formatPrice(p.discountedPrice || p.price)}</p>
                    {p.discountedPrice && <p className="text-dark-500 text-xs line-through">{formatPrice(p.price)}</p>}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${p.stock === 0 ? 'badge-red' : p.stock <= 5 ? 'badge-gold' : 'badge-green'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${p.isFeatured ? 'badge-gold' : 'bg-dark-700 text-dark-500 border border-white/10'}`}>
                      {p.isFeatured ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(p)} className="p-2 text-dark-400 hover:text-gold-400 transition-colors" title="Edit">
                      <FiEdit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(p._id, p.name)} className="p-2 text-dark-400 hover:text-red-400 transition-colors" title="Delete">
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs bg-dark-800 text-dark-400 hover:text-white border border-white/10 disabled:opacity-40">
              Prev
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).slice(
              Math.max(0, page - 3), Math.min(pagination.pages, page + 2)
            ).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs ${p === page ? 'bg-gold-500 text-dark-900' : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
              className="px-3 py-1.5 rounded-lg text-xs bg-dark-800 text-dark-400 hover:text-white border border-white/10 disabled:opacity-40">
              Next
            </button>
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
