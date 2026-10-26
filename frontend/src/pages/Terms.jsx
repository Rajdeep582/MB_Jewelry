import { Link } from 'react-router-dom';
import { FiFileText, FiAlertCircle, FiMapPin, FiPhoneCall, FiShoppingBag, FiCheckCircle, FiPackage, FiSlash } from 'react-icons/fi';

const SECTIONS = [
  { id: 'about', title: 'About Us & Acceptance of Terms', icon: FiShoppingBag },
  { id: 'use', title: 'Use of the Website', icon: FiFileText },
  { id: 'products', title: 'Product Information & Availability', icon: FiCheckCircle },
  { id: 'orders', title: 'Orders & Customer Responsibilities', icon: FiPackage },
  { id: 'delivery', title: 'Service & Delivery Area', icon: FiMapPin },
  { id: 'returns', title: 'No Returns & No Refunds', icon: FiSlash },
  { id: 'damaged', title: 'Damaged, Incorrect or Undelivered Products', icon: FiAlertCircle },
  { id: 'complaints', title: 'Complaints & Shop Visits', icon: FiPhoneCall },
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function Section({ index, highlight = false, children }) {
  const { id, title, icon: Icon } = SECTIONS[index];
  return (
    <section id={id} className={`card p-6 md:p-8 scroll-mt-28 ${highlight ? 'border-gold-500/30' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={18} className="text-gold-500" />
        </div>
        <div className="space-y-3 min-w-0">
          <h2 className="text-lg md:text-xl font-sans font-semibold text-white leading-snug">
            {index + 1}. {title}
          </h2>
          <div className="space-y-3 text-dark-300 text-sm md:text-base leading-relaxed">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Clause({ n, label, children }) {
  return (
    <p className="flex gap-3">
      <span className="text-gold-500 font-medium flex-shrink-0 tabular-nums">{n}</span>
      <span>
        {label && <strong className="text-white">{label} </strong>}
        {children}
      </span>
    </p>
  );
}

export default function Terms() {

  // Page title / description / canonical: components/common/RouteSeo.jsx


  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="section-subtitle mb-2">Legal & Policies</p>
          <h1 className="text-3xl md:text-4xl font-sans text-white font-normal leading-tight">Terms & Conditions</h1>
          <div className="gold-divider mt-4 mb-4" />
          <p className="text-dark-400 text-sm max-w-xl mx-auto">
            Please read these Terms & Conditions carefully before using our website or placing an order.
          </p>
        </div>

        {/* Contents */}
        <nav aria-label="Contents" className="card p-6 md:p-8 mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-4">Contents</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className="text-left text-dark-300 hover:text-gold-400 transition-colors cursor-pointer"
                >
                  <span className="text-gold-500 tabular-nums mr-2">{i + 1}.</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          <Section index={0}>
            <Clause n="1.1">
              M.B. JEWELLERS (“M.B. JEWELLERS”, “we”, “us” or “our”) is a local jewelry business providing fine jewelry
              items and customer services.
            </Clause>
            <Clause n="1.2">
              By accessing, browsing or using our website, you (“you” or “customer”) acknowledge and agree to comply
              with, and be bound by, these Terms & Conditions.
            </Clause>
          </Section>

          <Section index={1}>
            <Clause n="2.1">This website is provided to allow customers to:</Clause>
            <ul className="list-disc pl-12 space-y-1">
              <li>view our jewelry collections;</li>
              <li>place orders;</li>
              <li>submit custom jewelry requests; and</li>
              <li>manage their customer accounts.</li>
            </ul>
            <Clause n="2.2">
              You agree to use the website only for lawful purposes and in a manner that does not interfere with the
              proper functioning or security of the website.
            </Clause>
          </Section>

          <Section index={2}>
            <Clause n="3.1">
              We make every effort to display the details, photographs, descriptions and pricing of our jewelry items
              as accurately as possible.
            </Clause>
            <Clause n="3.2">
              As jewelry pieces may be handcrafted or subject to the availability of metals and gemstones, all items
              are offered subject to stock availability and may be updated without prior notice.
            </Clause>
          </Section>

          <Section index={3}>
            <Clause n="4.1">
              When placing an order or registering an account, you are responsible for providing accurate, complete
              and current information, including your full name, a reachable contact telephone number and an accurate
              delivery address.
            </Clause>
            <Clause n="4.2">
              M.B. JEWELLERS cannot be held responsible for delivery issues arising from incorrect or incomplete
              information provided by the customer.
            </Clause>
          </Section>

          <Section index={4}>
            <Clause n="5.1">
              Our business operations and local service and delivery coverage are focused in{' '}
              <span className="text-gold-400 font-medium">New Barrackpur</span>,{' '}
              <span className="text-gold-400 font-medium">Madhyamgram</span> and{' '}
              <span className="text-gold-400 font-medium">Barasat</span>, West Bengal.
            </Clause>
            <Clause n="5.2">Orders and delivery requests are serviced within our designated operational areas.</Clause>
          </Section>

          <Section index={5} highlight>
            <Clause n="6.1" label="No Returns.">
              We do not offer returns. All sales are final once an item has been purchased and received.
            </Clause>
            <Clause n="6.2" label="No Refunds.">
              We do not offer refunds. Payments made for jewelry orders are non-refundable.
            </Clause>
          </Section>

          <Section index={6}>
            <Clause n="7.1">
              If you receive a damaged or incorrect product, or do not receive the product you ordered, please contact
              our customer service team immediately.
            </Clause>
            <Clause n="7.2">
              We take order fulfillment seriously and will review and handle the issue appropriately.
            </Clause>
          </Section>

          <Section index={7}>
            <Clause n="8.1">
              You may contact our customer service team or visit our physical shop directly to raise any complaint,
              concern or request regarding your order.
            </Clause>
            <Clause n="8.2">
              All such complaints are handled through customer service, and each request is reviewed individually
              based on the circumstances of the particular case.
            </Clause>
            <div className="pt-2">
              <Link to="/contact" className="btn-outline-gold text-sm py-2.5 px-5">
                Contact Customer Service
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
