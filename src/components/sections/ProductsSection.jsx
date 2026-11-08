import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShoppingCart, 
  Sparkles, 
  Star, 
  AlertTriangle, 
  PackageCheck,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

export default function ProductsSection() {
  const { 
    products, 
    addToCart, 
    setIsCheckoutOpen,
    setSelectedProductForReview, 
    setIsReviewsOpen,
    searchQuery,
    selectedCategory,
    setSelectedCategory,
    currentUser,
    setIsAuthOpen,
    showToast
  } = useApp();

  const categories = [
    { id: 'all', label: 'All Products' },
    { id: 'mortar', label: 'Self-Leveling Mortar' },
    { id: 'epoxy', label: 'Structural Epoxy' },
    { id: 'admixture', label: 'Admixtures & Plasticizers' },
    { id: 'waterproof', label: 'Waterproofing Membranes' }
  ];

  // Filtering
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      product.title.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      product.specs.some(spec => spec.toLowerCase().includes(query));
    
    return matchesCategory && matchesSearch;
  });

  const handleBuyNow = (product) => {
    if (!currentUser) {
      showToast('Please sign in to your account first before using Buy Now.', 'warning');
      setIsAuthOpen(true);
      return;
    }
    if (product.stock <= 0) return;
    addToCart(product, 1);
    setIsCheckoutOpen(true);
  };

  const handleOpenReviews = (product) => {
    setSelectedProductForReview(product);
    setIsReviewsOpen(true);
  };

  return (
    <section id="products" className="py-16 sm:py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
              <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Official Construction Chemical Store</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Industrial Products Catalog
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              Browse sample high-durability products for national highways, bridges, and commercial infrastructure.
            </p>
          </div>

          {/* Bulky discount notification banner */}
          <div className="bg-gradient-to-r from-blue-900 to-[#0b1b3d] text-white px-4 py-3 rounded-xl border border-blue-800 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <TrendingDown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300">Contractor Volume Discount Active</div>
              <div className="text-xs text-slate-200">
                Automatic <span className="font-extrabold text-white">10% Bulky Discount</span> for 5+ units or use voucher <code className="bg-blue-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">ARCHON20</code> for 20% OFF.
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Pills (Horizontal Scroll on Mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 sm:mb-8 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#0b1b3d] text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-500 text-sm">No industrial products found matching "{searchQuery}".</p>
            <button
              onClick={() => { setSelectedCategory('all'); }}
              className="mt-3 text-xs font-bold text-blue-600 hover:underline"
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map(product => {
              const isOutOfStock = product.stock <= 0;
              const isLowStock = product.stock > 0 && product.stock <= 10;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col group"
                >
                  {/* Image & Badges */}
                  <div className="relative bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-6 flex items-center justify-center h-52 sm:h-60 overflow-hidden">
                    {/* Badge */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                      <span className="bg-[#0b1b3d] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md shadow-sm">
                        {product.badge}
                      </span>
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                        {product.discount}
                      </span>
                    </div>

                    {/* Stock indicator badge */}
                    <div className="absolute top-3 right-3 z-10">
                      {isOutOfStock ? (
                        <span className="bg-rose-100 text-rose-700 border border-rose-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          Low Stock: {product.stock} left
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          In Stock: {product.stock}
                        </span>
                      )}
                    </div>

                    <img
                      src={product.image}
                      alt={product.title}
                      onError={(e) => {
                        if (product.title && product.title.includes('MF3000')) {
                          e.currentTarget.src = '/assets/images/mf3000_concrete_pavement_road_additive.png';
                        } else if (product.title && product.title.includes('Rapid')) {
                          e.currentTarget.src = '/assets/images/rapid_24h_concrete_accelerator_compound.png';
                        }
                      }}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Body Content */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {/* Rating & Sold */}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <button
                          onClick={() => handleOpenReviews(product)}
                          className="flex items-center gap-1 text-amber-500 font-bold hover:underline"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{product.rating}</span>
                          <span className="text-slate-400 font-normal">({product.sold} sold)</span>
                        </button>

                        <button
                          onClick={() => handleOpenReviews(product)}
                          className="text-[11px] text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-blue-500" />
                          <span>Review Summary</span>
                        </button>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {product.title}
                      </h3>

                      {/* Specs */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {product.specs.map((spec, i) => (
                          <span
                            key={i}
                            className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Pricing & Actions */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-lg sm:text-xl font-extrabold text-blue-600">
                            PHP {product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-slate-400 line-through ml-2">
                            PHP {product.originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">Standard Pack</span>
                      </div>

                      {/* Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => addToCart(product, 1)}
                          disabled={isOutOfStock}
                          className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                            isOutOfStock
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95'
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>

                        <button
                          onClick={() => handleBuyNow(product)}
                          disabled={isOutOfStock}
                          className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                            isOutOfStock
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
                          }`}
                        >
                          <span>Buy Now</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
