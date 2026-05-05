/**
 * Product Seeder
 * Run: node backend/utils/seedProducts.js
 *
 * - Deletes products missing purity or weightValue (incompatible with dynamic pricing)
 * - Ensures standard categories exist
 * - Creates 20 production-style products across all material/purity/unit combos
 */

require('dotenv').config({ path: require('node:path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const GlobalPricing = require('../models/GlobalPricing');
const { calcDynamicPrice, buildGlobalPricingMap, resolvePricingEntry } = require('./pricingUtils');

const STANDARD_CATEGORIES = [
  { name: 'Necklaces', description: 'Gold, silver and diamond necklaces' },
  { name: 'Rings', description: 'Engagement rings, wedding bands and fashion rings' },
  { name: 'Bracelets', description: 'Bracelets and bangles for all occasions' },
  { name: 'Earrings', description: 'Studs, drops and hoop earrings' },
  { name: 'Bangles', description: 'Traditional and modern bangles' },
  { name: 'Pendants', description: 'Pendants and charms' },
];

const SEED_PRODUCTS = [
  // Gold 22K — gram
  { name: 'Royal Kundan Necklace', description: 'Exquisite 22K gold kundan necklace with intricate filigree work, perfect for weddings and festive occasions.', material: 'Gold', purity: '22K', unit: 'gram', weightValue: 18, category: 'Necklaces', stock: 5, isFeatured: true, makingCharges: 14, gst: 3 },
  { name: 'Classic Gold Band Ring', description: 'Timeless 22K gold band ring with a smooth polished finish. Ideal for daily wear.', material: 'Gold', purity: '22K', unit: 'gram', weightValue: 4.5, category: 'Rings', stock: 12, isFeatured: false, makingCharges: 12, gst: 3 },
  { name: 'Temple Design Bangle Set', description: 'Set of two 22K gold bangles with traditional temple motifs. Perfect for religious ceremonies.', material: 'Gold', purity: '22K', unit: 'gram', weightValue: 30, category: 'Bangles', stock: 3, isFeatured: true, makingCharges: 10, gst: 3 },
  { name: 'Gold Stud Earrings', description: 'Elegant 22K gold ball studs with a bright polished shine. Suitable for everyday elegance.', material: 'Gold', purity: '22K', unit: 'gram', weightValue: 3, category: 'Earrings', stock: 20, isFeatured: false, makingCharges: 15, gst: 3 },
  { name: 'Lotus Pendant', description: '22K gold lotus pendant symbolising purity and grace. Pairs beautifully with a matching chain.', material: 'Gold', purity: '22K', unit: 'gram', weightValue: 5.5, category: 'Pendants', stock: 8, isFeatured: false, makingCharges: 16, gst: 3 },

  // Gold 18K — gram
  { name: 'Modern Link Chain Necklace', description: 'Sleek 18K gold link chain with a contemporary geometric pattern. Versatile for all looks.', material: 'Gold', purity: '18K', unit: 'gram', weightValue: 14, category: 'Necklaces', stock: 7, isFeatured: true, makingCharges: 12, gst: 3 },
  { name: 'Tennis Bracelet', description: 'Elegant 18K gold tennis bracelet with a secure box clasp. A wardrobe staple.', material: 'Gold', purity: '18K', unit: 'gram', weightValue: 10, category: 'Bracelets', stock: 6, isFeatured: false, makingCharges: 12, gst: 3 },

  // Silver Normal — kg
  { name: 'Silver Anklet Pair', description: 'Traditional silver anklets with delicate bells. Handcrafted for comfort and style.', material: 'Silver', purity: 'Normal', unit: 'kg', weightValue: 0.08, category: 'Bracelets', stock: 15, isFeatured: false, makingCharges: 8, gst: 3 },
  { name: 'Silver Pooja Thali Set', description: 'Ornate silver thali set with engraved floral patterns. A perfect gifting item for auspicious occasions.', material: 'Silver', purity: 'Normal', unit: 'kg', weightValue: 0.3, category: 'Bangles', stock: 4, isFeatured: false, makingCharges: 7, gst: 3 },
  { name: 'Oxidised Silver Necklace', description: 'Bohemian oxidised silver necklace with tribal motifs. Pairs well with ethnic and fusion wear.', material: 'Silver', purity: 'Normal', unit: 'kg', weightValue: 0.06, category: 'Necklaces', stock: 10, isFeatured: false, makingCharges: 8, gst: 3 },

  // Silver Hallmarked — gram
  { name: 'Hallmarked Silver Cocktail Ring', description: 'Bold hallmarked silver cocktail ring with a hammered finish. Makes a strong fashion statement.', material: 'Silver', purity: 'Hallmarked', unit: 'gram', weightValue: 10, category: 'Rings', stock: 14, isFeatured: false, makingCharges: 10, gst: 3 },
  { name: 'BIS Silver Charm Bracelet', description: 'Delicate BIS hallmarked silver bracelet with five interchangeable charms. Great for gifting.', material: 'Silver', purity: 'Hallmarked', unit: 'gram', weightValue: 18, category: 'Bracelets', stock: 9, isFeatured: true, makingCharges: 9, gst: 3 },
  { name: 'Sterling Silver Drop Earrings', description: 'Elegant hallmarked sterling silver drop earrings with a secure lever-back closure.', material: 'Silver', purity: 'Hallmarked', unit: 'gram', weightValue: 6, category: 'Earrings', stock: 18, isFeatured: false, makingCharges: 10, gst: 3 },

  // Diamond 22K — gram
  { name: 'Solitaire Diamond Ring', description: 'Stunning 0.5ct solitaire diamond set in a 22K gold four-prong setting. The ultimate symbol of love.', material: 'Diamond', purity: '22K', unit: 'gram', weightValue: 3.5, category: 'Rings', stock: 4, isFeatured: true, makingCharges: 20, gst: 3 },
  { name: 'Diamond Cluster Pendant', description: 'Brilliant-cut diamond cluster pendant in a 22K gold bezel setting. Radiates luxury from every angle.', material: 'Diamond', purity: '22K', unit: 'gram', weightValue: 2.5, category: 'Pendants', stock: 6, isFeatured: true, makingCharges: 18, gst: 3 },

  // Diamond 18K — gram
  { name: 'Diamond Eternity Bracelet', description: 'Full-set diamond eternity bracelet in 18K white gold. A statement of timeless sophistication.', material: 'Diamond', purity: '18K', unit: 'gram', weightValue: 7, category: 'Bracelets', stock: 3, isFeatured: true, makingCharges: 18, gst: 3 },
  { name: 'Teardrop Diamond Earrings', description: 'Teardrop-shaped diamond earrings in 18K gold with a secure push-back closure. Glamorous for every occasion.', material: 'Diamond', purity: '18K', unit: 'gram', weightValue: 4.5, category: 'Earrings', stock: 5, isFeatured: false, makingCharges: 20, gst: 3 },

  // Diamond 14K — gram
  { name: 'Classic Diamond Necklace', description: 'A row of graduated brilliant-cut diamonds on a 14K gold chain. Versatile elegance for day or evening.', material: 'Diamond', purity: '14K', unit: 'gram', weightValue: 12, category: 'Necklaces', stock: 3, isFeatured: false, makingCharges: 15, gst: 3 },
  { name: 'Diamond Halo Bangle', description: 'Stunning diamond halo bangle in 14K gold. The surrounded diamond arrangement creates extraordinary sparkle.', material: 'Diamond', purity: '14K', unit: 'gram', weightValue: 15, category: 'Bangles', stock: 2, isFeatured: false, makingCharges: 15, gst: 3 },

  // Gold 18K — kg (bridal heavy piece)
  { name: 'Bridal Gold Necklace Set', description: 'Opulent 18K gold bridal necklace set with layered design and matching earrings. The centrepiece of a bride\'s trousseau.', material: 'Gold', purity: '18K', unit: 'kg', weightValue: 0.085, category: 'Necklaces', stock: 2, isFeatured: true, makingCharges: 12, gst: 3 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Delete old incompatible products (missing purity or zero/missing weightValue)
    const deleteResult = await Product.deleteMany({
      $or: [
        { purity: { $in: [null, undefined, ''] } },
        { weightValue: { $in: [null, undefined, 0] } },
        { pricingType: { $ne: 'dynamic' } },
      ],
    });
    console.log(`Deleted ${deleteResult.deletedCount} incompatible old products`);

    // 2. Ensure standard categories exist
    const catMap = {};
    for (const catData of STANDARD_CATEGORIES) {
      const cat = await Category.findOneAndUpdate(
        { name: catData.name },
        { $setOnInsert: { name: catData.name, description: catData.description } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      catMap[catData.name] = cat._id;
    }
    console.log('Categories ensured:', Object.keys(catMap).join(', '));

    // 3. Load global pricing
    const pricingEntries = await GlobalPricing.find({}).lean();
    const pricingMap = buildGlobalPricingMap(pricingEntries);
    console.log(`Found ${pricingEntries.length} global pricing entries`);

    if (pricingEntries.length === 0) {
      console.warn('WARNING: No global pricing entries found. Products will be created with price=0.');
      console.warn('Set up global pricing in Admin > Pricing & Discounts first, then re-run this seeder.');
    }

    // 4. Create seed products (skip if already named the same)
    let created = 0;
    let skipped = 0;
    for (const p of SEED_PRODUCTS) {
      const categoryId = catMap[p.category];
      if (!categoryId) { console.warn(`Category not found: ${p.category}`); continue; }

      const exists = await Product.findOne({ name: p.name });
      if (exists) { skipped++; continue; }

      // Resolve price from global pricing
      const { pricing, effectiveWeight } = resolvePricingEntry(pricingMap, p.material, p.purity, p.unit, p.weightValue);
      const price = pricing
        ? calcDynamicPrice(effectiveWeight, pricing.livePrice, p.makingCharges, p.gst)
        : 0;

      await Product.create({
        name: p.name,
        description: p.description,
        material: p.material,
        purity: p.purity,
        unit: p.unit,
        weightValue: p.weightValue,
        makingCharges: p.makingCharges,
        gst: p.gst,
        price,
        discountedPrice: null,
        category: categoryId,
        stock: p.stock,
        isFeatured: p.isFeatured,
        pricingType: 'dynamic',
        tags: [p.material.toLowerCase(), p.purity.toLowerCase(), p.category.toLowerCase()],
        images: [],
      });
      created++;
      console.log(`  ✓ ${p.name} (${p.material} ${p.purity} ${p.weightValue}${p.unit}) → ₹${price.toLocaleString('en-IN')}`);
    }

    console.log(`\nDone! Created: ${created}, Already existed (skipped): ${skipped}`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
