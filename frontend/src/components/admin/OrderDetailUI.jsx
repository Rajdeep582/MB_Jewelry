// Small presentational pieces shared by the admin Orders, Custom Orders and Deliveries pages.
import { useState } from 'react';
import { FiCopy, FiClock, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../utils/helpers';

/** Chip — small bordered label. Pass colour classes via className. */
export function Chip({ className = '', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

/** KV — label/value pair for a <dl>. Renders nothing when the value is empty. */
export function KV({ label, children, mono, className = '' }) {
  if (children === undefined || children === null || children === '' || children === false) return null;
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] uppercase tracking-wider text-dark-500">{label}</dt>
      <dd className={`text-xs text-dark-200 mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}

/** SectionTitle — small uppercase heading with a gold icon. */
export function SectionTitle({ icon, children, right }) {
  const Icon = icon;
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-300 flex items-center gap-1.5">
        {Icon && <Icon size={12} className="text-gold-500" />} {children}
      </h4>
      {right}
    </div>
  );
}

/** CopyBtn — copies a value (tracking no., payment id) to the clipboard. */
export function CopyBtn({ value, label }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`)).catch(() => {});
      }}
      className="p-1 rounded text-dark-500 hover:text-gold-400 hover:bg-white/5 transition-colors shrink-0"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      <FiCopy size={11} />
    </button>
  );
}

/** BillRow — one line of a price breakdown. */
export function BillRow({ label, children, strong }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'items-baseline pt-1.5 mt-1 border-t border-white/[0.06]' : 'text-dark-400'}`}>
      <span className={strong ? 'text-white font-medium' : ''}>{label}</span>
      <span className={strong ? 'text-gold-400 font-bold text-base' : 'text-dark-200'}>{children}</span>
    </div>
  );
}

/** Timeline — newest-first status history, collapsible (bare = list only, no header). */
export function Timeline({ entries, labels = {}, defaultOpen = true, bare = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const list = [...(entries || [])].reverse();
  if (list.length === 0) return null;
  const items = (
    <ol>
      {list.map((entry, idx) => {
        const at = entry.timestamp || entry.createdAt;
        return (
          <li key={`${entry.status}-${at || idx}`} className="flex gap-2.5">
            <div className="flex flex-col items-center w-3 shrink-0">
              <span className={`w-2 h-2 rounded-full mt-1 ${idx === 0 ? 'bg-gold-400 ring-2 ring-gold-500/20' : 'bg-dark-600'}`} />
              {idx !== list.length - 1 && <span className="flex-1 w-px bg-dark-700 my-0.5" />}
            </div>
            <div className="pb-2.5 flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-xs font-medium ${idx === 0 ? 'text-white' : 'text-dark-300'}`}>
                  {labels[entry.status] || entry.status?.replaceAll('_', ' ')}
                </p>
                {at && <time className="text-[10px] text-dark-500 shrink-0 tabular-nums">{formatDateTime(at)}</time>}
              </div>
              {entry.comment && <p className="text-[11px] text-dark-500 mt-0.5 leading-snug">{entry.comment}</p>}
              {entry.updatedBy?.name && <p className="text-[10px] text-dark-600 mt-0.5">by {entry.updatedBy.name}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
  if (bare) return items;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-300 hover:text-white transition-colors mb-2"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5"><FiClock size={12} className="text-gold-500" /> Timeline ({list.length})</span>
        <FiChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && items}
    </div>
  );
}
