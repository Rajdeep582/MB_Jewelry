import { useEffect, useState } from 'react';
import { FiMail, FiPhone, FiMapPin, FiSend, FiInstagram, FiTwitter } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = 'Contact Us — M&B Jewelry'; }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    toast.success('Message sent! We\'ll reply within 24 hours. 💍');
    setForm({ name: '', email: '', subject: '', message: '' });
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="section-subtitle mb-3">Get In Touch</p>
          <h1 className="section-title">Contact Us</h1>
          <div className="gold-divider mt-4" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Info */}
          <div className="lg:col-span-1 space-y-5">
            <div className="card p-5">
              <h2 className="font-display text-xl text-white mb-4">Reach Out</h2>
              {[
                { icon: FiMail, title: 'Email', value: 'hello@mbjewelry.com', href: 'mailto:hello@mbjewelry.com' },
                { icon: FiPhone, title: 'Phone', value: '+91 98765 43210', href: 'tel:+919876543210' },
                { icon: FiMapPin, title: 'Store', value: 'Bandra West, Mumbai\nMaharashtra — 400050', href: null },
              ].map((item) => {
                 
                const SIcon = item.icon;
                return (
                <div key={item.title} className="flex gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl glass-gold flex items-center justify-center flex-shrink-0">
                    <SIcon size={15} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-xs text-dark-500 uppercase tracking-wider mb-0.5">{item.title}</p>
                    {item.href ? (
                      <a href={item.href} className="text-dark-300 text-sm hover:text-gold-400 transition-colors">{item.value}</a>
                    ) : (
                      <p className="text-dark-300 text-sm whitespace-pre">{item.value}</p>
                    )}
                  </div>
                </div>
              )})}
            </div>

            <div className="card p-5">
              <h3 className="text-white font-medium mb-3">Business Hours</h3>
              {[
                ['Monday – Friday', '10:00 AM – 7:00 PM'],
                ['Saturday', '10:00 AM – 5:00 PM'],
                ['Sunday', 'Closed'],
              ].map(([day, hours]) => (
                <div key={day} className="flex justify-between text-sm mb-2">
                  <span className="text-dark-400">{day}</span>
                  <span className={hours === 'Closed' ? 'text-red-400' : 'text-white'}>{hours}</span>
                </div>
              ))}
            </div>

            <div className="card p-5">
              <h3 className="text-white font-medium mb-3">Follow Us</h3>
              <div className="flex gap-3">
                {[FiInstagram, FiTwitter].map((SIcon, i) => {
                   
                  const ActiveIcon = SIcon;
                  return (
                  <button type="button" key={SIcon.displayName || SIcon.name} className="w-9 h-9 rounded-full glass-gold flex items-center justify-center text-gold-400 hover:scale-110 transition-transform">
                    <ActiveIcon size={16} />
                  </button>
                )})}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h2 className="font-display text-xl text-white mb-5">Send a Message</h2>
              <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-dark" htmlFor="contact-name">Full Name</label>
                    <input id="contact-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name" className="input-dark" required />
                  </div>
                  <div>
                    <label className="label-dark" htmlFor="contact-email">Email</label>
                    <input id="contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@example.com" className="input-dark" required />
                  </div>
                </div>
                <div>
                  <label className="label-dark" htmlFor="contact-subject">Subject</label>
                  <input id="contact-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Order inquiry, custom design, etc." className="input-dark" required />
                </div>
                <div>
                  <label className="label-dark" htmlFor="contact-message">Message</label>
                  <textarea id="contact-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="How can we help you?" rows={5} className="input-dark resize-none" required />
                </div>
                <button type="submit" disabled={submitting} className="btn-gold py-3 gap-2">
                  {submitting ? (
                    <><span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <><FiSend size={15} /> Send Message</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
