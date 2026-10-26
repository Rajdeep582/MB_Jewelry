import { useEffect, useState } from 'react';
import { FiUserPlus, FiMail, FiPhone, FiInbox, FiEdit3, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { adminService } from '../../services/services';

const NOTE_MAX = 500;

/** Leads — every customer account + footer newsletter emails. Email / call buttons + admin note per lead. */
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

  const onNoteSaved = (email, note) =>
    setRows((prev) => prev.map((r) => (r.email === email ? { ...r, note } : r)));

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

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : rows.length === 0 && !error ? (
        <div className="card py-14 text-center">
          <FiInbox size={28} className="mx-auto text-dark-600 mb-3" />
          <p className="text-dark-300 text-sm">No leads yet</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 items-start">
          {rows.map((l) => <LeadCard key={l._id} lead={l} onSaved={onNoteSaved} />)}
        </ul>
      )}
    </div>
  );
}

function LeadCard({ lead, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lead.note || '');
  const [saving, setSaving] = useState(false);

  const name = lead.name || 'Newsletter subscriber';
  const initial = (lead.name || lead.email || '?').trim().charAt(0).toUpperCase();

  const startEdit = () => { setDraft(lead.note || ''); setEditing(true); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminService.saveLeadNote(lead.email, draft);
      onSaved(lead.email, res.data.note);
      setEditing(false);
      toast.success(res.data.note ? 'Note saved' : 'Note removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="group rounded-2xl border border-white/[0.07] bg-dark-800/60 p-4 transition-colors hover:border-gold-500/25">
      {/* Who */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-gold-400/30 to-gold-600/10 border border-gold-500/30 flex items-center justify-center text-gold-200 font-semibold">
          {initial}
        </span>
        <p className="text-sm sm:text-base text-white font-medium truncate">{name}</p>
      </div>

      {/* Contact buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            title={`Email ${lead.email}`}
            className="inline-flex items-center gap-2 min-w-0 max-w-full rounded-xl border border-gold-500/25 bg-gold-500/10 px-3 py-2 text-xs text-gold-200 transition hover:bg-gold-500/20 hover:border-gold-400/50 active:scale-[0.97]"
          >
            <FiMail size={14} className="shrink-0" />
            <span className="truncate">{lead.email}</span>
          </a>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            title={`Call ${lead.phone}`}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-500/20 hover:border-emerald-400/50 active:scale-[0.97]"
          >
            <FiPhone size={14} className="shrink-0" />
            <span className="tabular-nums">{lead.phone}</span>
          </a>
        )}
      </div>

      {/* Note */}
      <div className="mt-3">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
              rows={3}
              autoFocus
              placeholder="Add a note to remember…"
              className="w-full resize-none rounded-xl border border-white/[0.10] bg-dark-900/70 px-3 py-2 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-500/50"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-dark-500 tabular-nums">{draft.length}/{NOTE_MAX}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-xs text-dark-300 hover:text-white hover:bg-white/[0.06] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-semibold text-dark-900 hover:bg-gold-400 active:scale-[0.97] transition disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : lead.note ? (
          <button
            type="button"
            onClick={startEdit}
            title="Edit note"
            className="w-full text-left rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 transition hover:border-amber-400/40"
          >
            <span className="flex items-start gap-2">
              <FiEdit3 size={13} className="mt-0.5 shrink-0 text-amber-300/80" />
              <span className="text-xs text-amber-100/90 whitespace-pre-wrap break-words">{lead.note}</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.12] px-3 py-1.5 text-xs text-dark-400 transition hover:text-gold-300 hover:border-gold-500/40"
          >
            <FiPlus size={12} /> Add note
          </button>
        )}
      </div>
    </li>
  );
}
