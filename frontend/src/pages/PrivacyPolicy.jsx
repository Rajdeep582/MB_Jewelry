import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShield, FiLock, FiDatabase, FiMail, FiCheckCircle, FiUsers, FiArrowLeft } from 'react-icons/fi';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Privacy Policy — M.B. JEWELLERS';
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
          <p className="section-subtitle mb-2">Transparency & Trust</p>
          <h1 className="text-3xl md:text-4xl font-serif text-white font-normal leading-tight">Privacy Policy</h1>
          <div className="gold-divider mt-4 mb-4" />
          <p className="text-dark-400 text-sm max-w-xl mx-auto">
            We respect your privacy and are committed to being clear and transparent about how your information is handled.
          </p>
        </div>

        {/* Content Container */}
        <div className="space-y-6">
          {/* Section 1: Overview */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiShield size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">1. Introduction</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  M.B. JEWELLERS is a local jewelry business serving customers in New Barrackpur, Madhyamgram, and Barasat, West Bengal. This Privacy Policy explains what customer information we store and how it is used to operate our website and fulfill jewelry orders and services.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Information We Collect and Store */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiDatabase size={18} className="text-gold-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">2. Information We Store</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  To provide website functionality, customer accounts, and order processing, we store information provided by you when you use the website:
                </p>
                <ul className="space-y-2 text-dark-300 text-sm md:text-base leading-relaxed">
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span><strong className="text-white">Account Details:</strong> Your name, email address, mobile number, and password (stored in a securely encrypted, hashed form).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span><strong className="text-white">Delivery Addresses:</strong> Recipient full name, contact phone number, street address, city, state, and postal pincode for order fulfillment.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span><strong className="text-white">Order & Inquiry Information:</strong> Products ordered, order amounts, custom jewelry design requests, wishlist items, and payment transaction identifiers provided by our payment gateway.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span><strong className="text-white">Preferences:</strong> Notification preferences and communication settings chosen by you.</span>
                  </li>
                </ul>
                <p className="text-dark-400 text-xs md:text-sm pt-1">
                  <em>Note:</em> We do not store your complete credit/debit card numbers or bank credentials on our servers. Online payments are processed through secure integration with Razorpay.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: How Information is Used */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiLock size={18} className="text-gold-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">3. How We Use Customer Information</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  Customer information is collected and used strictly for operating the website and delivering customer/order-related services:
                </p>
                <ul className="space-y-2 text-dark-300 text-sm md:text-base leading-relaxed">
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span>Creating and managing your user account and login sessions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span>Processing, packaging, and coordinating delivery of your jewelry orders.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span>Reviewing and handling custom jewelry requests and customer inquiries.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
                    <span>Communicating about orders, services, or relevant product and business notifications where such functionality exists.</span>
                  </li>
                </ul>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  Customer data is not used for unrelated purposes.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Information Sharing */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiUsers size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">4. Information Sharing & Third Parties</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  The business does not intentionally sell customer personal information to third parties. Customer information is shared only when necessary for website functionality, order processing, delivery, customer service, or other normal website operations (such as processing payments securely through Razorpay or coordinating delivery with authorized delivery personnel).
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Data Storage & Retention */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiDatabase size={18} className="text-gold-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">5. Data Storage & Security</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  Information is stored when necessary for website functionality, maintaining customer accounts, managing orders, local delivery, customer service records, and normal website operations. We employ standard security measures, including encrypted passwords, secure session tokens, and protected connections, to safeguard your information.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Contact & Questions */}
          <section className="card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <FiMail size={18} className="text-gold-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg md:text-xl font-serif font-semibold text-white leading-snug">6. Contact Us Regarding Privacy</h2>
                <p className="text-dark-300 text-sm md:text-base leading-relaxed">
                  If you have any questions about this Privacy Policy, your account data, or wish to update your details, you may reach out to customer service or visit our physical shop directly.
                </p>
                <div className="pt-2">
                  <Link to="/contact" className="btn-outline-gold text-sm py-2.5 px-5">
                    Contact Us
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
