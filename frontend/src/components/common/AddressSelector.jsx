import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';

const ADDRESS_FIELDS = [
  { name: 'fullName',     label: 'Full Name',                  col: 2 },
  { name: 'phone',        label: 'Phone Number',               col: 1 },
  { name: 'addressLine1', label: 'Address Line 1',             col: 2 },
  { name: 'addressLine2', label: 'Address Line 2 (optional)',  col: 2 },
  { name: 'city',         label: 'City',                       col: 1 },
  { name: 'state',        label: 'State',                      col: 1 },
  { name: 'pincode',      label: 'PIN Code',                   col: 1 },
];

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
  if (addrLoading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-xl skeleton bg-dark-700/50" />)}</div>;
  }

  return (
    <>
      {/* Saved addresses */}
      <div className="space-y-3">
        {addresses.map((ad) => (
          <div
            key={ad._id}
            role="button"
            tabIndex={0}
            onClick={() => { setSelectedAddrId(ad._id); setShowNewAddr(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedAddrId(ad._id);
                setShowNewAddr(false);
              }
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedAddrId === ad._id && !showNewAddr
                ? 'border-gold-500 bg-gold-500/5'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white text-sm font-medium">{ad.fullName}</p>
                  {ad.isDefault && <span className="badge badge-gold text-xs">Default</span>}
                </div>
                <p className="text-dark-400 text-xs">{ad.addressLine1}, {ad.city}, {ad.state} — {ad.pincode}</p>
                <p className="text-dark-500 text-xs mt-0.5">{ad.phone}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedAddrId === ad._id && !showNewAddr ? 'border-gold-500' : 'border-dark-500'
              }`}>
                {selectedAddrId === ad._id && !showNewAddr && <div className="w-2.5 h-2.5 rounded-full bg-gold-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => { setShowNewAddr(!showNewAddr); if (!showNewAddr) setSelectedAddrId(null); }}
        className="text-gold-500 hover:text-gold-400 text-sm transition-colors mt-3 block"
      >
        {showNewAddr ? '← Use saved address' : '+ Use a different address'}
      </button>

      <AnimatePresence>
        {showNewAddr && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden mt-3"
          >
            {ADDRESS_FIELDS.map(({ name, label, col }) => (
              <div key={name} className={col === 2 ? 'sm:col-span-2' : ''}>
                <label htmlFor={`addr-${name}`} className="label-dark">{label}</label>
                <input
                  id={`addr-${name}`}
                  type="text"
                  value={newAddr[name]}
                  onChange={(e) => setNewAddr((p) => ({ ...p, [name]: e.target.value }))}
                  className="input-dark text-sm"
                />
              </div>
            ))}
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
