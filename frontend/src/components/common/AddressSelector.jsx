import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiPlus, FiArrowLeft, FiPhone, FiMapPin } from 'react-icons/fi';
import PropTypes from 'prop-types';
import { REQUIRED_ADDR_FIELDS } from '../../utils/helpers';

const ADDRESS_FIELDS = [
  { name: 'fullName',     label: 'Full Name',                 col: 2, placeholder: 'Name of the recipient',        autoComplete: 'name' },
  { name: 'phone',        label: 'Phone Number',              col: 1, placeholder: '10-digit mobile number',       autoComplete: 'tel', inputMode: 'tel' },
  { name: 'pincode',      label: 'PIN Code',                  col: 1, placeholder: '6-digit PIN',                  autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6 },
  { name: 'addressLine1', label: 'Address Line 1',            col: 2, placeholder: 'House no., building, street',  autoComplete: 'address-line1' },
  { name: 'addressLine2', label: 'Address Line 2 (optional)', col: 2, placeholder: 'Area, landmark',               autoComplete: 'address-line2' },
  { name: 'city',         label: 'City',                      col: 1, placeholder: 'City',                         autoComplete: 'address-level2' },
  { name: 'state',        label: 'State',                     col: 1, placeholder: 'State',                        autoComplete: 'address-level1' },
];

// Display-only hints — mirror the checks done on submit
function fieldHint(name, value) {
  const v = String(value ?? '').trim();
  if (REQUIRED_ADDR_FIELDS.includes(name) && !v) return 'Required';
  if (name === 'phone' && v && !/^[6-9]\d{9}$/.test(v.replaceAll(/\s/g, ''))) return 'Enter a valid 10-digit mobile number';
  if (name === 'pincode' && v && !/^\d{6}$/.test(v)) return 'PIN code must be 6 digits';
  return '';
}

export default function AddressSelector({
  addresses,
  selectedAddrId,
  setSelectedAddrId,
  showNewAddr,
  setShowNewAddr,
  newAddr,
  setNewAddr,
  addrLoading
}) {
  const [touched, setTouched] = useState({});

  if (addrLoading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-16 rounded-xl skeleton bg-dark-700/50" />)}</div>;
  }

  const hasSaved = addresses.length > 0;

  return (
    <>
      {/* Saved addresses */}
      {!showNewAddr && hasSaved && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map((ad) => {
            const selected = selectedAddrId === ad._id && !showNewAddr;
            return (
              <motion.button
                type="button"
                key={ad._id}
                onClick={() => { setSelectedAddrId(ad._id); setShowNewAddr(false); }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className={`relative p-3.5 rounded-xl border cursor-pointer transition-colors w-full text-left ${
                  selected
                    ? 'border-gold-500 bg-gold-500/[0.06] shadow-[0_0_0_1px_rgba(212,175,55,0.25)]'
                    : 'border-white/10 bg-dark-900/40 hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-medium truncate">{ad.fullName}</p>
                      {ad.isDefault && <span className="badge badge-gold text-[10px] py-0.5">Default</span>}
                    </div>
                    <p className="text-dark-400 text-xs leading-relaxed flex items-start gap-1.5">
                      <FiMapPin size={11} className="mt-0.5 flex-shrink-0 text-dark-500" />
                      <span>{ad.addressLine1}{ad.addressLine2 ? `, ${ad.addressLine2}` : ''}, {ad.city}, {ad.state} — {ad.pincode}</span>
                    </p>
                    <p className="text-dark-500 text-xs mt-1 flex items-center gap-1.5"><FiPhone size={11} /> {ad.phone}</p>
                  </div>
                  <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
                    selected ? 'bg-gold-500 text-dark-900' : 'border-2 border-dark-500'
                  }`}>
                    <AnimatePresence>
                      {selected && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                          <FiCheck size={12} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {(hasSaved || !showNewAddr) && (
        <button
          type="button"
          onClick={() => { setShowNewAddr(!showNewAddr); if (!showNewAddr) setSelectedAddrId(null); }}
          className={`mt-3 inline-flex items-center gap-2 text-sm font-medium transition-colors ${
            showNewAddr
              ? 'text-dark-300 hover:text-gold-400'
              : 'w-full justify-center py-2.5 rounded-xl border border-dashed border-gold-500/40 text-gold-400 hover:bg-gold-500/[0.06] hover:border-gold-500/70'
          }`}
        >
          {showNewAddr ? <><FiArrowLeft size={14} /> Use a saved address</> : <><FiPlus size={14} /> Add a new address</>}
        </button>
      )}

      <AnimatePresence initial={false}>
        {showNewAddr && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 pt-3">
              {ADDRESS_FIELDS.map(({ name, label, col, placeholder, autoComplete, inputMode, maxLength }) => {
                const value = newAddr[name] ?? '';
                const hint  = touched[name] ? fieldHint(name, value) : '';
                const ok    = touched[name] && !fieldHint(name, value) && String(value).trim();
                return (
                  <div key={name} className={col === 2 ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`addr-${name}`} className="block text-xs font-medium text-dark-300 mb-1">{label}</label>
                    <div className="relative">
                      <input
                        id={`addr-${name}`}
                        type="text"
                        value={value}
                        placeholder={placeholder}
                        autoComplete={autoComplete}
                        inputMode={inputMode}
                        maxLength={maxLength}
                        onChange={(e) => setNewAddr((p) => ({ ...p, [name]: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
                        aria-invalid={!!hint}
                        className={`input-dark text-sm py-2.5 pr-9 placeholder:text-dark-600 ${hint ? '!border-red-500/60 focus:!ring-red-500/30' : ''} ${ok ? 'border-gold-500/40' : ''}`}
                      />
                      <AnimatePresence>
                        {ok && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-400"
                          >
                            <FiCheck size={14} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <AnimatePresence>
                      {hint && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-[11px] mt-1">
                          {hint}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

AddressSelector.propTypes = {
  addresses: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      fullName: PropTypes.string.isRequired,
      phone: PropTypes.string.isRequired,
      addressLine1: PropTypes.string.isRequired,
      addressLine2: PropTypes.string,
      city: PropTypes.string.isRequired,
      state: PropTypes.string.isRequired,
      pincode: PropTypes.string.isRequired,
      isDefault: PropTypes.bool,
    })
  ).isRequired,
  selectedAddrId: PropTypes.string,
  setSelectedAddrId: PropTypes.func.isRequired,
  showNewAddr: PropTypes.bool.isRequired,
  setShowNewAddr: PropTypes.func.isRequired,
  newAddr: PropTypes.object.isRequired,
  setNewAddr: PropTypes.func.isRequired,
  addrLoading: PropTypes.bool.isRequired,
};
