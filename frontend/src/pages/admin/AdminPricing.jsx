import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiPercent, FiDollarSign, FiTag, FiBox } from 'react-icons/fi';
import { categoryService, adminService } from '../../services/services';
import toast from 'react-hot-toast';

const MATERIALS = ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'];

export default function AdminPricing() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [pricingForm, setPricingForm] = useState({
    material: '',
    category: '',
    operation: 'percentage',
    amount: ''
  });

  const [discountForm, setDiscountForm] = useState({
    targetType: 'global',
    targetId: '',
    discountType: 'percentage',
    discountValue: ''
  });

  useEffect(() => {
    document.title = 'Pricing & Discounts — Admin';
    categoryService.getCategories().then(res => {
      setCategories(res.data.categories);
      setLoading(false);
    });
  }, []);

  const handlePricingSubmit = async (e) => {
    e.preventDefault();
    if (!pricingForm.material && !pricingForm.category) {
      toast.error('Must specify a Material or Category');
      return;
    }
    const amount = Number(pricingForm.amount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Invalid amount');
      return;
    }
    try {
      const res = await adminService.bulkUpdatePricing({ ...pricingForm, amount });
      toast.success(res.data.message);
      setPricingForm({ ...pricingForm, amount: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDiscountSubmit = async (e) => {
    e.preventDefault();
    const value = Number(discountForm.discountValue);
    if (discountForm.discountType !== 'remove' && (isNaN(value) || value <= 0)) {
      toast.error('Invalid discount value');
      return;
    }
    if (discountForm.targetType !== 'global' && !discountForm.targetId) {
      toast.error('Target ID is required for product/category');
      return;
    }
    try {
      const res = await adminService.bulkUpdateDiscounts({ ...discountForm, discountValue: value });
      toast.success(res.data.message);
      setDiscountForm({ ...discountForm, discountValue: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-white">Pricing &amp; Discounts</h1>
        <p className="text-dark-400 text-sm">Bulk update base prices and storewide discounts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* === PRICING MODULE === */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FiDollarSign size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg text-white">Bulk Base Pricing</h2>
              <p className="text-dark-400 text-xs">Increase or decrease global material rates</p>
            </div>
          </div>

          <form onSubmit={handlePricingSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">By Material</label>
                <select value={pricingForm.material} onChange={e => setPricingForm({...pricingForm, material: e.target.value})} className="input-dark">
                  <option value="">Any</option>
                  {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label-dark">By Category</label>
                <select value={pricingForm.category} onChange={e => setPricingForm({...pricingForm, category: e.target.value})} className="input-dark">
                  <option value="">Any</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">Operation</label>
                <select value={pricingForm.operation} onChange={e => setPricingForm({...pricingForm, operation: e.target.value})} className="input-dark">
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="label-dark">Value (e.g. 10 or -10)</label>
                <input type="number" required value={pricingForm.amount} onChange={e => setPricingForm({...pricingForm, amount: e.target.value})} placeholder="+/- Amount" className="input-dark" />
              </div>
            </div>
            <button type="submit" className="btn-gold w-full mt-4 py-2.5">Apply Price Update</button>
          </form>
        </div>

        {/* === DISCOUNT MODULE === */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <FiPercent size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg text-white">Discount Manager</h2>
              <p className="text-dark-400 text-xs">Apply flat/percentage discounts globally</p>
            </div>
          </div>

          <form onSubmit={handleDiscountSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">Target Scope</label>
                <select value={discountForm.targetType} onChange={e => setDiscountForm({...discountForm, targetType: e.target.value})} className="input-dark">
                  <option value="global">Global (All Products)</option>
                  <option value="category">Specific Category</option>
                  <option value="product">Specific Product ID</option>
                </select>
              </div>
              {discountForm.targetType === 'category' && (
                <div>
                  <label className="label-dark">Category</label>
                  <select value={discountForm.targetId} onChange={e => setDiscountForm({...discountForm, targetId: e.target.value})} className="input-dark" required>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {discountForm.targetType === 'product' && (
                <div>
                  <label className="label-dark">Product ID</label>
                  <input type="text" value={discountForm.targetId} onChange={e => setDiscountForm({...discountForm, targetId: e.target.value})} placeholder="64b1f..." className="input-dark" required />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">Discount Type</label>
                <select value={discountForm.discountType} onChange={e => setDiscountForm({...discountForm, discountType: e.target.value})} className="input-dark">
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="remove">Remove Discounts</option>
                </select>
              </div>
              {discountForm.discountType !== 'remove' && (
                <div>
                  <label className="label-dark">Value (Positive)</label>
                  <input type="number" min="0" step="0.01" required value={discountForm.discountValue} onChange={e => setDiscountForm({...discountForm, discountValue: e.target.value})} placeholder="e.g. 15" className="input-dark" />
                </div>
              )}
            </div>
            <button type="submit" className="btn-gold w-full mt-4 py-2.5">Update Discounts</button>
          </form>
        </div>

      </div>
    </div>
  );
}
