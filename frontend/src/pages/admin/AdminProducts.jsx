import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiEdit3, FiTrash2, FiSearch, FiX, FiUpload } from 'react-icons/fi';
import { productService, categoryService } from '../../services/services';
import { formatPrice, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const MATERIALS = ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'];
const TYPES = ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle', 'Brooch', 'Set'];

function ProductForm({ product, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || '', description: product?.description || '',
    price: product?.price || '', discountedPrice: product?.discountedPrice || '',
    material: product?.material || 'Gold', type: product?.type || 'Ring',
    category: product?.category?._id || '', stock: product?.stock ?? 0,
    isFeatured: product?.isFeatured || false, weight: product?.weight || '',
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    files.forEach((f) => fd.append('images', f));

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark">Product Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" required />
          </div>
          <div>
            <label className="label-dark">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input-dark resize-none" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-dark">Price (₹)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-dark" required />
            </div>
            <div>
              <label className="label-dark">Discounted (₹)</label>
              <input type="number" value={form.discountedPrice} onChange={(e) => setForm({ ...form, discountedPrice: e.target.value })} className="input-dark" />
            </div>
            <div>
              <label className="label-dark">Stock</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-dark" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-dark">Material</label>
              <select value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} className="input-dark">
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-dark">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-dark">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label-dark">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-dark" required>
                <option value="">Select...</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="featured" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="accent-gold-500" />
            <label htmlFor="featured" className="text-sm text-dark-400 cursor-pointer">Featured product</label>
          </div>
          <div>
            <label className="label-dark">Images (max 6)</label>
            <label className="flex items-center gap-2 input-dark cursor-pointer hover:border-gold-500 transition-colors">
              <FiUpload size={14} className="text-dark-400" />
              <span className="text-dark-400 text-sm">{files.length > 0 ? `${files.length} file(s) selected` : 'Choose images...'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files))} />
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5">
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
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => { document.title = 'Products — Admin'; }, []);

  const loadData = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      productService.getProducts({ search, page: pagination.page, limit: 20 }),
      categoryService.getCategories(),
    ]);
    setProducts(prodRes.data.products);
    setPagination(prodRes.data.pagination);
    setCategories(catRes.data.categories);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [search, pagination.page]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await productService.deleteProduct(id);
      toast.success('Product deleted');
      loadData();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">Products</h1>
          <p className="text-dark-400 text-sm">{pagination.total} products total</p>
        </div>
        <button onClick={() => { setEditProduct(null); setShowForm(true); }} className="btn-gold text-sm gap-2">
          <FiPlus size={14} /> Add Product
        </button>
      </div>

      <div className="card p-4">
        <div className="relative mb-4">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="input-dark pl-9 text-sm" />
        </div>

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
              ) : products.map((p) => (
                <tr key={p._id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                          <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
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
                    <span className={`badge ${p.isFeatured ? 'badge-gold' : 'bg-dark-700 text-dark-400 border border-white/10'}`}>
                      {p.isFeatured ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="p-2 text-dark-400 hover:text-gold-400 transition-colors">
                      <FiEdit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(p._id, p.name)} className="p-2 text-dark-400 hover:text-red-400 transition-colors">
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ProductForm
          product={editProduct}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
