/**
 * ============================================================
 *  M&B Jewelry — MongoDB Seed Script
 *  Connects to Atlas, drops old data, and seeds:
 *    1. Categories  (8 types)
 *    2. Users       (1 admin + 2 demo customers)
 *    3. Products    (24 items matching demoProducts.js)
 * ============================================================
 *  Run:  node backend/seed.js
 * ============================================================
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Models ───────────────────────────────────────────────────
const Category = require('./models/Category');
const User     = require('./models/User');
const Product  = require('./models/Product');
const Order    = require('./models/Order');

// ── Placeholder image (Cloudinary-style object) ──────────────
// We use a publicly hosted necklace image so Product.images[].publicId is valid.
const PH_URL  = 'https://res.cloudinary.com/demo/image/upload/v1/samples/jewelry/rendering.png';
const PH_PID  = 'samples/jewelry/rendering';

const img = (url = PH_URL, pid = PH_PID) => ({ url, publicId: pid });

async function seed() {
  console.log('\n🔗  Connecting to MongoDB Atlas…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅  Connected!\n');

  // ── 1. Clear existing data ────────────────────────────────
  console.log('🗑   Clearing old collections…');
  await Promise.all([
    Order.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    Category.deleteMany({}),
  ]);
  console.log('   done.\n');

  // ── 2. Seed Categories ────────────────────────────────────
  console.log('📂  Seeding categories…');
  const catDefs = [
    { name: 'Rings',      slug: 'rings',      description: 'Engagement rings, wedding bands, cocktail rings & more.' },
    { name: 'Necklaces',  slug: 'necklaces',  description: 'Chains, pendants, chokers, and statement necklaces.' },
    { name: 'Earrings',   slug: 'earrings',   description: 'Studs, hoops, jhumkas, chandeliers & drop earrings.' },
    { name: 'Bracelets',  slug: 'bracelets',  description: 'Bangles, kadas, tennis bracelets & charm bracelets.' },
    { name: 'Pendants',   slug: 'pendants',   description: 'Religious, diamond & gemstone pendants.' },
    { name: 'Anklets',    slug: 'anklets',    description: 'Gold and silver anklets for daily & bridal wear.' },
    { name: 'Sets',       slug: 'sets',       description: 'Matching necklace + earring bridal sets.' },
    { name: 'Brooches',   slug: 'brooches',   description: 'Decorative pins and brooches.' },
  ];
  const cats = await Category.insertMany(catDefs);
  const catMap = Object.fromEntries(cats.map(c => [c.name, c._id]));
  console.log(`   ${cats.length} categories created.\n`);

  // ── 3. Seed Users ─────────────────────────────────────────
  console.log('👤  Seeding users…');
  const salt = await bcrypt.genSalt(12);

  const adminHash    = await bcrypt.hash('Admin@1234', salt);
  const customer1Hash = await bcrypt.hash('Customer@1234', salt);
  const customer2Hash = await bcrypt.hash('Customer@1234', salt);

  const users = await User.insertMany([
    {
      name: 'Admin Rajdeep',
      email: 'admin@mbjewelry.com',
      password: adminHash,
      role: 'admin',
      phone: '+91-9876543210',
      isActive: true,
    },
    {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: customer1Hash,
      role: 'user',
      phone: '+91-9123456789',
      isActive: true,
      addresses: [{
        fullName: 'Priya Sharma',
        phone: '+91-9123456789',
        addressLine1: '12 Rose Garden',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        isDefault: true,
      }],
    },
    {
      name: 'Anita Reddy',
      email: 'anita@example.com',
      password: customer2Hash,
      role: 'user',
      phone: '+91-9988776655',
      isActive: true,
    },
  ]);
  console.log(`   ${users.length} users created.`);
  console.log('   Admin  → admin@mbjewelry.com  / Admin@1234');
  console.log('   User 1 → priya@example.com    / Customer@1234');
  console.log('   User 2 → anita@example.com    / Customer@1234\n');

  // ── 4. Seed Products ──────────────────────────────────────
  console.log('💍  Seeding products…');

  const products = [
    // ── NECKLACES ─────────────────────────────────────────
    {
      name: 'Layered Diamond Solitaire Necklace',
      description: 'A breathtaking layered necklace featuring a single brilliant-cut diamond suspended from 18K gold. Perfect for everyday elegance or special occasions.',
      price: 45000, discountedPrice: 38000,
      category: catMap['Necklaces'], material: 'Gold', type: 'Necklace',
      images: [img(), img()], stock: 12, isFeatured: true, sold: 34,
      averageRating: 4.9, numReviews: 128,
      tags: ['diamond', 'solitaire', 'layered', 'gold', 'wedding'], weight: '4.2g',
      sku: 'NL-DS-001',
    },
    {
      name: 'Kundan Polki Statement Necklace',
      description: 'Handcrafted Kundan Polki necklace with a royal heritage design, perfect for bridal wear. Each stone is hand-set by skilled artisans.',
      price: 72000, discountedPrice: null,
      category: catMap['Necklaces'], material: 'Gold', type: 'Necklace',
      images: [img(), img()], stock: 5, isFeatured: true, sold: 18,
      averageRating: 5.0, numReviews: 64,
      tags: ['kundan', 'polki', 'bridal', 'statement'], weight: '89g',
      sku: 'NL-KP-002',
    },
    {
      name: 'Emerald Drop Long Chain Necklace',
      description: 'Elegant long chain with natural emerald drop pendants set in 22K gold. The vivid green gemstones make this a showstopper at any event.',
      price: 58000, discountedPrice: 49000,
      category: catMap['Necklaces'], material: 'Gold', type: 'Necklace',
      images: [img(), img()], stock: 8, isFeatured: true, sold: 22,
      averageRating: 4.7, numReviews: 92,
      tags: ['emerald', 'drop', 'long chain', 'gold'], weight: '12.5g',
      sku: 'NL-ED-003',
    },
    {
      name: 'Pearl Collar Necklace — Vintage',
      description: 'Timeless vintage-style pearl collar in sterling silver, a wardrobe staple that complements both traditional and contemporary outfits.',
      price: 18500, discountedPrice: 14999,
      category: catMap['Necklaces'], material: 'Silver', type: 'Necklace',
      images: [img(), img()], stock: 20, isFeatured: false, sold: 61,
      averageRating: 4.6, numReviews: 47,
      tags: ['pearl', 'collar', 'vintage', 'silver'], weight: '22g',
      sku: 'NL-PC-004',
    },
    {
      name: 'Mangalsutra Tanmaniya Gold',
      description: 'Traditional Mangalsutra Tanmaniya crafted in 22K hallmarked gold. A symbol of love and commitment, beautifully designed for modern brides.',
      price: 32000, discountedPrice: null,
      category: catMap['Necklaces'], material: 'Gold', type: 'Necklace',
      images: [img(), img()], stock: 15, isFeatured: true, sold: 89,
      averageRating: 4.8, numReviews: 211,
      tags: ['mangalsutra', 'tanmaniya', 'bridal', 'gold', '22K'], weight: '6.8g',
      sku: 'NL-MT-005',
    },
    {
      name: 'Sapphire & Diamond Rivière Necklace',
      description: 'Platinum rivière necklace with alternating natural sapphires and round diamonds. A timeless piece that embodies luxury and sophistication.',
      price: 125000, discountedPrice: 109000,
      category: catMap['Necklaces'], material: 'Platinum', type: 'Necklace',
      images: [img(), img()], stock: 3, isFeatured: true, sold: 7,
      averageRating: 5.0, numReviews: 19,
      tags: ['sapphire', 'diamond', 'riviere', 'platinum', 'luxury'], weight: '18g',
      sku: 'NL-SR-006',
    },

    // ── RINGS ─────────────────────────────────────────────
    {
      name: 'Solitaire Diamond Engagement Ring',
      description: 'Classic six-prong solitaire engagement ring with a GIA-certified 1ct diamond in 18K white gold. The perfect symbol of everlasting love.',
      price: 85000, discountedPrice: 75000,
      category: catMap['Rings'], material: 'Gold', type: 'Ring',
      images: [img(), img()], stock: 10, isFeatured: true, sold: 112,
      averageRating: 5.0, numReviews: 345,
      tags: ['engagement', 'solitaire', 'diamond', 'GIA', 'wedding'], weight: '3.8g',
      sku: 'RG-SE-007',
    },
    {
      name: 'Ruby Cocktail Statement Ring',
      description: 'Bold Burmese ruby cocktail ring surrounded by pavé-set diamonds in 18K gold. A head-turning piece for special events.',
      price: 42000, discountedPrice: null,
      category: catMap['Rings'], material: 'Gold', type: 'Ring',
      images: [img(), img()], stock: 7, isFeatured: false, sold: 28,
      averageRating: 4.8, numReviews: 88,
      tags: ['ruby', 'cocktail', 'diamond', 'pave', 'statement'], weight: '5.1g',
      sku: 'RG-RC-008',
    },
    {
      name: 'Eternity Band — Full Diamond',
      description: 'Full eternity band set with round brilliant diamonds in platinum. Symbolises never-ending love, perfect for anniversaries and wedding upgrades.',
      price: 96000, discountedPrice: 89000,
      category: catMap['Rings'], material: 'Platinum', type: 'Ring',
      images: [img(), img()], stock: 4, isFeatured: true, sold: 19,
      averageRating: 4.9, numReviews: 57,
      tags: ['eternity', 'diamond', 'platinum', 'anniversary'], weight: '4.4g',
      sku: 'RG-EB-009',
    },
    {
      name: 'Floral Meenakari Finger Ring',
      description: 'Vibrant Meenakari enamel ring with a floral motif in 22K gold. Brings the richness of Rajasthani craftsmanship to your fingertips.',
      price: 12500, discountedPrice: 9999,
      category: catMap['Rings'], material: 'Gold', type: 'Ring',
      images: [img(), img()], stock: 30, isFeatured: false, sold: 77,
      averageRating: 4.5, numReviews: 133,
      tags: ['meenakari', 'enamel', 'floral', 'traditional', 'Rajasthan'], weight: '4.0g',
      sku: 'RG-FM-010',
    },
    {
      name: 'Rose Gold Twisted Band Ring',
      description: 'Sleek twisted rose gold band, minimalist yet striking. Stackable design that pairs beautifully with any ring on your hand.',
      price: 22000, discountedPrice: 18500,
      category: catMap['Rings'], material: 'Rose Gold', type: 'Ring',
      images: [img(), img()], stock: 18, isFeatured: false, sold: 45,
      averageRating: 4.7, numReviews: 76,
      tags: ['rose gold', 'twisted', 'band', 'minimalist', 'stackable'], weight: '2.9g',
      sku: 'RG-RT-011',
    },
    {
      name: 'Emerald Halo Princess Ring',
      description: 'Princess-cut natural emerald with a double diamond halo in 18K gold. Vivid colour meets exceptional brilliance in this luxury ring.',
      price: 67000, discountedPrice: 59000,
      category: catMap['Rings'], material: 'Gold', type: 'Ring',
      images: [img(), img()], stock: 6, isFeatured: true, sold: 13,
      averageRating: 4.9, numReviews: 41,
      tags: ['emerald', 'halo', 'princess cut', 'diamond', 'luxury'], weight: '4.6g',
      sku: 'RG-EH-012',
    },

    // ── EARRINGS ───────────────────────────────────────────
    {
      name: 'Jhumka Chandelier Earrings — Gold',
      description: 'Traditional jhumka chandelier earrings with intricate filigree work in 22K gold. A festive staple that enhances any traditional outfit.',
      price: 24000, discountedPrice: null,
      category: catMap['Earrings'], material: 'Gold', type: 'Earrings',
      images: [img(), img()], stock: 22, isFeatured: true, sold: 98,
      averageRating: 4.8, numReviews: 189,
      tags: ['jhumka', 'chandelier', 'filigree', 'traditional', 'festive'], weight: '18g',
      sku: 'ER-JC-013',
    },
    {
      name: 'Diamond Stud Earrings — 0.5ct Pair',
      description: 'Timeless 0.5ct diamond stud earrings in 4-prong platinum setting. A must-have in every fine jewellery collection.',
      price: 55000, discountedPrice: 48000,
      category: catMap['Earrings'], material: 'Platinum', type: 'Earrings',
      images: [img(), img()], stock: 14, isFeatured: true, sold: 134,
      averageRating: 5.0, numReviews: 272,
      tags: ['diamond', 'studs', 'platinum', 'classic', 'everyday'], weight: '2.8g',
      sku: 'ER-DS-014',
    },
    {
      name: 'Sapphire Drop Dangle Earrings',
      description: 'Oval Ceylon sapphire drop earrings with diamond accents in yellow gold. The deep blue sapphires are ethically sourced and certified.',
      price: 31000, discountedPrice: 26500,
      category: catMap['Earrings'], material: 'Gold', type: 'Earrings',
      images: [img(), img()], stock: 9, isFeatured: false, sold: 31,
      averageRating: 4.7, numReviews: 53,
      tags: ['sapphire', 'drop', 'dangle', 'Ceylon', 'diamond'], weight: '7.2g',
      sku: 'ER-SD-015',
    },
    {
      name: 'South Sea Pearl Drop Earrings',
      description: 'Lustrous South Sea pearl drop earrings set in 18K yellow gold. The pearls are 10–12mm and handpicked for their exceptional lustre.',
      price: 19500, discountedPrice: null,
      category: catMap['Earrings'], material: 'Gold', type: 'Earrings',
      images: [img(), img()], stock: 11, isFeatured: false, sold: 24,
      averageRating: 4.6, numReviews: 38,
      tags: ['pearl', 'south sea', 'drop', 'gold', 'luxury'], weight: '9g',
      sku: 'ER-SP-016',
    },
    {
      name: 'Peacock Kundan Bali Earrings',
      description: 'Intricate peacock-motif Kundan bali earrings — a festive favourite. The vibrant stones and gold setting make them ideal for weddings.',
      price: 14000, discountedPrice: 11500,
      category: catMap['Earrings'], material: 'Gold', type: 'Earrings',
      images: [img(), img()], stock: 25, isFeatured: true, sold: 67,
      averageRating: 4.9, numReviews: 107,
      tags: ['peacock', 'kundan', 'bali', 'festive', 'wedding'], weight: '22g',
      sku: 'ER-PK-017',
    },
    {
      name: 'Oxidised Silver Hoop Earrings',
      description: 'Bold oxidised silver hoop earrings with tribal-inspired texture. Lightweight and comfortable for all-day wear.',
      price: 5500, discountedPrice: 3999,
      category: catMap['Earrings'], material: 'Silver', type: 'Earrings',
      images: [img(), img()], stock: 50, isFeatured: false, sold: 185,
      averageRating: 4.4, numReviews: 231,
      tags: ['oxidised', 'silver', 'hoop', 'tribal', 'boho'], weight: '15g',
      sku: 'ER-OH-018',
    },

    // ── BRACELETS ─────────────────────────────────────────
    {
      name: 'Tennis Bracelet — Diamond Line',
      description: 'Iconic diamond tennis bracelet with 3ct total weight in platinum. A red-carpet staple that elevates any look with timeless glamour.',
      price: 110000, discountedPrice: 98000,
      category: catMap['Bracelets'], material: 'Platinum', type: 'Bracelet',
      images: [img(), img()], stock: 4, isFeatured: true, sold: 11,
      averageRating: 5.0, numReviews: 62,
      tags: ['tennis', 'diamond', 'platinum', 'luxury', 'glamour'], weight: '9g',
      sku: 'BR-TD-019',
    },
    {
      name: 'Gold Bangles Set — Matte Finish',
      description: 'Set of 4 matte-finish 22K gold bangles, perfect for stacking. The understated design is versatile for both casual and formal wear.',
      price: 36000, discountedPrice: null,
      category: catMap['Bracelets'], material: 'Gold', type: 'Bangle',
      images: [img(), img()], stock: 16, isFeatured: true, sold: 72,
      averageRating: 4.8, numReviews: 154,
      tags: ['bangles', 'matte', 'gold', '22K', 'stackable', 'set'], weight: '32g',
      sku: 'BR-GB-020',
    },
    {
      name: 'Charm Bracelet — Rose Gold',
      description: 'Playful rose gold charm bracelet with 7 customisable charms. Add your own personality to this delightful everyday piece.',
      price: 28500, discountedPrice: 22000,
      category: catMap['Bracelets'], material: 'Rose Gold', type: 'Bracelet',
      images: [img(), img()], stock: 13, isFeatured: false, sold: 39,
      averageRating: 4.6, numReviews: 89,
      tags: ['charm', 'rose gold', 'customisable', 'everyday'], weight: '8g',
      sku: 'BR-CR-021',
    },
    {
      name: 'Antique Kada — Temple Jewellery',
      description: 'Heavy antique temple-style gold kada with deity motif carvings. A cherished keepsake that carries generations of craftsmanship.',
      price: 48000, discountedPrice: 42000,
      category: catMap['Bracelets'], material: 'Gold', type: 'Bracelet',
      images: [img(), img()], stock: 8, isFeatured: false, sold: 29,
      averageRating: 4.9, numReviews: 73,
      tags: ['kada', 'antique', 'temple', 'deity', 'traditional'], weight: '56g',
      sku: 'BR-AK-022',
    },

    // ── PENDANTS ──────────────────────────────────────────
    {
      name: 'Om Diamond Pendant — 22K Gold',
      description: 'Sacred Om symbol pendant studded with diamonds in 22K gold. A meaningful and beautiful gift for any occasion.',
      price: 15000, discountedPrice: 12500,
      category: catMap['Pendants'], material: 'Gold', type: 'Pendant',
      images: [img(), img()], stock: 40, isFeatured: false, sold: 203,
      averageRating: 4.8, numReviews: 318,
      tags: ['om', 'diamond', 'religious', 'pendant', 'gift'], weight: '3.2g',
      sku: 'PD-OD-023',
    },
    {
      name: 'Lakshmi Coin Locket — Antique',
      description: 'Hand-engraved Lakshmi coin locket in antique gold finish, ideal for puja and gifting. A timeless auspicious piece.',
      price: 21000, discountedPrice: null,
      category: catMap['Pendants'], material: 'Gold', type: 'Pendant',
      images: [img(), img()], stock: 19, isFeatured: true, sold: 91,
      averageRating: 5.0, numReviews: 145,
      tags: ['lakshmi', 'coin', 'locket', 'antique', 'religious', 'puja'], weight: '5.8g',
      sku: 'PD-LC-024',
    },
  ];

  const insertedProducts = await Product.insertMany(products);
  console.log(`   ${insertedProducts.length} products created.\n`);

  // ── 5. Summary ────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('✅  DATABASE SEEDED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════');
  console.log('\n📊  Collections created in MongoDB:');
  console.log(`   • categories  → ${cats.length} documents`);
  console.log(`   • users       → ${users.length} documents`);
  console.log(`   • products    → ${insertedProducts.length} documents`);
  console.log(`   • orders      → 0 documents (ready for real orders)`);
  console.log('\n🔐  Admin login credentials:');
  console.log('   Email   : admin@mbjewelry.com');
  console.log('   Password: Admin@1234');
  console.log('\n🚀  Now start your backend:  cd backend && npm run dev\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
