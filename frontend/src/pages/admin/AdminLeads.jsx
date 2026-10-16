import { useEffect, useState } from 'react';
import { FiUserPlus, FiMail, FiPhone, FiInbox } from 'react-icons/fi';
import { adminService } from '../../services/services';

/** Leads — every customer account + footer newsletter emails. Tap email/phone to contact. */
export default function AdminLeads() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Leads — Admin';
    adminService.getLeads()
      .then((res) => setRows(res.data.leads))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load leads'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-gold-500/[0.10] via-dark-900/60 to-dark-900/30 p-4 sm:p-5">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gold-500/15 border border-gold-500/25 flex items-center justify-center text-gold-300">
              <FiUserPlus size={20} />
            </span>
            <h1 className="font-display text-xl text-white">Leads</h1>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-dark-900/50 px-3 py-1.5 min-w-[72px]">
            <p className="text-[10px] uppercase tracking-wider text-dark-500">Total</p>
            <p className="text-lg font-semibold tabular-nums text-gold-300 leading-tight">{loading ? '—' : rows.length}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center">
            <FiInbox size={28} className="mx-auto text-dark-600 mb-3" />
            <p className="text-dark-300 text-sm">No leads yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {rows.map((l) => (
              <li key={l._id} className="px-4 py-3">
                <p className="text-sm text-white font-medium truncate">{l.name || 'Newsletter subscriber'}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {l.email && (
                    <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 min-w-0 text-dark-300 hover:text-gold-300">
                      <FiMail size={12} className="shrink-0 text-gold-500/80" /><span className="truncate">{l.email}</span>
                    </a>
                  )}
                  {l.phone && (
                    <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 text-dark-300 hover:text-gold-300">
                      <FiPhone size={12} className="shrink-0 text-gold-500/80" />{l.phone}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
