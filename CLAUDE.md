Perform a focused fix and validation of navigation + product mapping across the application.

This is an almost production-ready system, so do NOT modify existing business logic, architecture, or APIs. Work carefully with frontend navigation and database consistency only.

Objective
Make navigation accurate, smooth, and consistent
Ensure correct product categorization and visibility
Maintain strict alignment with existing backend logic
Tasks
1. Navigation Fix (Home / Shop / Gold / Silver / Diamond / Others)
Analyze navigation flow across:
Home
Shop (all products)
Category-specific pages (Gold, Silver, Diamond, etc.)
Fix issues where:
Clicking nav items leads to wrong section (e.g., footer or broken scroll)
Routing or anchor links are incorrect
Filters are not applied properly
Ensure:
Home → correct sections
Shop → shows all products
Gold/Silver/Diamond → only their respective products
Smooth and consistent behavior across all nav items
2. Strict Product Categorization
Validate all products in DB:
Each product must belong to the correct material/category
No misclassified products
Enforce:
Gold → only gold products
Silver → only silver products
Diamond → only diamond products
Fix incorrect mappings without breaking schema
3. Missing Data Handling
Identify missing product types or categories
If any category lacks sufficient products:
Populate with realistic data
Follow existing schema strictly
Maintain correct category linkage
4. DB ↔ Frontend Interaction
Ensure frontend correctly fetches:
All products for Shop
Filtered products for each category
Verify:
API responses align with UI expectations
No empty states due to bad queries or mapping issues
Critical Constraints
❌ Do NOT modify backend logic or APIs
❌ Do NOT change schema structure
❌ Do NOT break existing functionality
❌ Do NOT remove or alter existing images
✅ Use existing images where already present
✅ Only fix navigation, mapping, and data consistency
Final Goal
Navigation is fully functional and smooth
Each category shows only correct products
Shop shows complete product set
No missing or misclassified data
System behaves cleanly and predictably without breaking anything