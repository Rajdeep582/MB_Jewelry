import { Link } from 'react-router-dom';
import { FiShield, FiLock, FiDatabase, FiMail, FiCheckCircle, FiUsers } from 'react-icons/fi';

const SECTIONS = [
  { id: 'introduction', title: 'Introduction', icon: FiShield },
  { id: 'information-we-store', title: 'Information We Store', icon: FiDatabase },
  { id: 'how-we-use', title: 'How We Use Your Information', icon: FiLock },
  { id: 'sharing', title: 'Information Sharing & Third Parties', icon: FiUsers },
  { id: 'storage-security', title: 'Data Storage & Security', icon: FiDatabase },
  { id: 'contact', title: 'Contact Us About Privacy', icon: FiMail },
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function Section({ index, children }) {
  const { id, title, icon: Icon } = SECTIONS[index];
  return (
    <section id={id} className="card p-6 md:p-8 scroll-mt-28">
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

function Clause({ n, children }) {
  return (
    <p className="flex gap-3">
      <span className="text-gold-500 font-medium flex-shrink-0 tabular-nums">{n}</span>
      <span>{children}</span>
    </p>
  );
}

function Item({ label, children }) {
  return (
    <li className="flex items-start gap-2">
      <FiCheckCircle size={16} className="text-gold-500 flex-shrink-0 mt-1" />
      <span>
        {label && <strong className="text-white">{label}: </strong>}
        {children}
      </span>
    </li>
  );
}

export default function PrivacyPolicy() {

  // Page title / description / canonical: components/common/RouteSeo.jsx


  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="section-subtitle mb-2">Transparency & Trust</p>
          <h1 className="text-3xl md:text-4xl font-sans text-white font-normal leading-tight">Privacy Policy</h1>
          <div className="gold-divider mt-4 mb-4" />
          <p className="text-dark-400 text-sm max-w-xl mx-auto">
            We respect your privacy and are committed to being clear and transparent about how your information is
            handled.
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
              M.B. JEWELLERS (“M.B. JEWELLERS”, “we”, “us” or “our”) is a local jewelry business serving customers in
              New Barrackpur, Madhyamgram and Barasat, West Bengal.
            </Clause>
            <Clause n="1.2">
              This Privacy Policy explains what customer information we store and how it is used to operate our
              website and to fulfil jewelry orders and services.
            </Clause>
          </Section>

          <Section index={1}>
            <Clause n="2.1">
              To provide website functionality, customer accounts and order processing, we store the following
              information that you provide when using the website:
            </Clause>
            <ul className="space-y-2 pl-9">
              <Item label="Account details">
                your name, email address, mobile number and password (stored in a securely encrypted, hashed form);
              </Item>
              <Item label="Delivery addresses">
                recipient’s full name, contact phone number, street address, city, state and postal PIN code, for
                order fulfilment;
              </Item>
              <Item label="Order and inquiry information">
                products ordered, order amounts, custom jewelry design requests, wishlist items and payment
                transaction identifiers provided by our payment gateway; and
              </Item>
              <Item label="Preferences">notification preferences and communication settings chosen by you.</Item>
            </ul>
            <Clause n="2.2">
              We do not store your complete credit or debit card numbers or your bank credentials on our servers.
              Online payments are processed through a secure integration with Razorpay.
            </Clause>
          </Section>

          <Section index={2}>
            <Clause n="3.1">
              Customer information is collected and used strictly for operating the website and delivering customer
              and order-related services, namely:
            </Clause>
            <ul className="space-y-2 pl-9">
              <Item>creating and managing your user account and login sessions;</Item>
              <Item>processing, packaging and coordinating the delivery of your jewelry orders;</Item>
              <Item>reviewing and handling custom jewelry requests and customer inquiries; and</Item>
              <Item>
                communicating with you about orders, services, or relevant product and business notifications, where
                such functionality exists.
              </Item>
            </ul>
            <Clause n="3.2">Customer data is not used for unrelated purposes.</Clause>
          </Section>

          <Section index={3}>
            <Clause n="4.1">We do not intentionally sell customer personal information to third parties.</Clause>
            <Clause n="4.2">
              Customer information is shared only when necessary for website functionality, order processing,
              delivery, customer service or other normal website operations — for example, processing payments
              securely through Razorpay or coordinating delivery with authorised delivery personnel.
            </Clause>
          </Section>

          <Section index={4}>
            <Clause n="5.1">
              Information is stored when necessary for website functionality, maintaining customer accounts, managing
              orders, local delivery, customer service records and normal website operations.
            </Clause>
            <Clause n="5.2">
              We employ standard security measures — including encrypted passwords, secure session tokens and
              protected connections — to safeguard your information.
            </Clause>
          </Section>

          <Section index={5}>
            <Clause n="6.1">
              If you have any questions about this Privacy Policy or your account data, or wish to update your
              details, you may contact our customer service team or visit our physical shop directly.
            </Clause>
            <div className="pt-2">
              <Link to="/contact" className="btn-outline-gold text-sm py-2.5 px-5">
                Contact Us
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
