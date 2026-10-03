import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiFileText, FiAlertCircle, FiMapPin, FiPhoneCall, FiShoppingBag, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';

export default function Terms() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Terms & Conditions — M.B. JEWELLERS';
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-gold-400 transition-colors group cursor-pointer"
            aria-label="Go back to previous page"
          >
            <FiArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-200" />
            <span>Back</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <p className="section-subtitle mb-2">Legal & Policies</p>
          <h1 className="text-3xl md:text-4xl font-serif text-white font-normal leading-tight">Terms & Conditions</h1>
          <div className="gold-divider mt-4 mb-4" />
          <p className="text-dark-400 text-sm max-w-xl mx-auto">
            Please read these terms and conditions carefully before using our website or placing an order.
          </p>
        </div>

        {/* Content Container */}
        <div className="space-y-6">
          {/* Section 1: Introduction & About the Business */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiShoppingBag size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">1. About M.B. JEWELLERS</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  M.B. JEWELLERS is a local jewelry business providing fine jewelry items and customer services. By accessing, browsing, or using our website, you acknowledge and agree to comply with and be bound by these Terms & Conditions.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: General Use of the Website */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiFileText size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">2. General Use of the Website</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  This website is provided to allow customers to view our jewelry collections, place orders, submit custom jewelry requests, and manage their customer accounts. You agree to use the website only for lawful purposes and in a manner that does not interfere with the proper functioning or security of the site.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Product Information & Availability */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiCheckCircle size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">3. Product Information & Availability</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  We make every effort to display the details, photographs, descriptions, and pricing of our jewelry items as accurately as possible. Because jewelry pieces may be handcrafted or subject to metal and gemstone availability, all items are offered subject to stock availability and may be updated without prior notice.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Orders & Customer Responsibilities */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiCheckCircle size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">4. Orders & Customer Responsibilities</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  When placing an order or registering an account, you are responsible for providing accurate, complete, and current information, including your full name, reachable contact telephone number, and accurate delivery address. The business cannot be held responsible for delivery issues arising from incorrect or incomplete information provided by the customer.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Local Service & Delivery Area */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiMapPin size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">5. Service & Delivery Coverage Area</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  Our business operations and local service/delivery coverage are focused in <span className="text-gold-400 font-medium">New Barrackpur</span>, <span className="text-gold-400 font-medium">Madhyamgram</span>, and <span className="text-gold-400 font-medium">Barasat</span> in West Bengal. Orders and delivery requests are serviced within our designated operational areas.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: No Return Policy & No Refund Policy */}
          <section className="card p-6 md:p-8 border-gold-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiAlertCircle size={18} className="text-gold-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">6. No Return & No Refund Policy</h2>
                <div className="space-y-2 text-dark-300 text-sm md:text-base leading-relaxed">
                  <p>
                    <strong className="text-white">No Return Policy: </strong>
                    There is no return policy. All sales are final once an item is purchased and received.
                  </p>
                  <p>
                    <strong className="text-white">No Refund Policy: </strong>
                    There is no refund policy. Payments made for jewelry orders are non-refundable.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Damaged, Incorrect, or Missing Products */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiAlertCircle size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">7. Damaged, Incorrect, or Missing Products</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  If you receive a damaged product, an incorrect product, or do not receive the required/ordered product, please contact our customer service team immediately. We take order fulfillment seriously and will review and handle the issue appropriately.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8: Complaint Resolution & Physical Shop Visit */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiPhoneCall size={18} className="text-gold-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">8. Complaint Resolution & Shop Visits</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  Customers may reach out to our customer service or visit our physical shop directly to raise any complaint, concern, or request regarding their order.
                </p>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  The business will handle such complaints through customer service and review each request individually based on the particular case.
                </p>
                <div className="pt-2">
                  <Link to="/contact" className="btn-outline-gold text-sm py-2.5 px-5">
                    Contact Customer Service
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
