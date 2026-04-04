const fs = require('fs');
const path = require('path');

const materials = ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'];
const types = ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Pendant', 'Bangle', 'Anklet', 'Brooch', 'Set'];
const purities = ['24K', '22K', 'None'];

const imageSrc = "const img = '/src/assets/necklace.webp';\n\n";

let demoProducts = [];
let idCounter = 1;

// Basic ones covering all explicit types & materials (100 combinations)
for (let i = 0; i < 150; i++) {
  const m = materials[Math.floor(Math.random() * materials.length)];
  const t = types[Math.floor(Math.random() * types.length)];
  const basePrice = Math.floor(Math.random() * 90000) + 10000;
  
  // Decide purity
  let p = 'None';
  if (m === 'Gold' || m === 'Rose Gold') p = Math.random() > 0.5 ? '22K' : '24K';
  
  // Decide highlight
  let hm = Math.random() > 0.4;
  let feat = Math.random() > 0.8;
  
  let o = {
    _id: `demo-${String(idCounter).padStart(3, '0')}`,
    name: `${p !== 'None' ? p + ' ' : ''}${m} ${t} - V${i}`,
    material: m,
    type: t,
    purity: p,
    isHallmarked: hm,
    price: basePrice,
    discountedPrice: Math.random() > 0.5 ? basePrice - 2000 : null,
    stock: Math.floor(Math.random() * 50), // Include 0 for out of stock edge cases
    averageRating: (Math.random() * 2 + 3).toFixed(1),
    numReviews: Math.floor(Math.random() * 500),
    images: [{ url: "img" }, { url: "img" }],
    featured: feat,
    description: `A stunning ${m.toLowerCase()} ${t.toLowerCase()} for all occasions.`
  };
  demoProducts.push(o);
  idCounter++;
}

// Write the file as a JS module
const jsonStr = JSON.stringify(demoProducts, null, 2);
// The stringify wrapped "img" as a string, let's fix it so it refers to the JS variable `img`
const cleanStr = jsonStr.replace(/"img"/g, "img");

const finalContent = `// Auto-generated heavy test payload
${imageSrc}const DEMO_PRODUCTS = ${cleanStr};

export default DEMO_PRODUCTS;
`;

fs.writeFileSync(path.join(__dirname, '..', 'frontend', 'src', 'data', 'demoProducts.js'), finalContent);
console.log('Successfully wrote 150 randomized products for massive data testing!');
