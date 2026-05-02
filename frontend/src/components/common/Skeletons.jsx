// Skeleton components for loading states
import PropTypes from 'prop-types';
export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-square w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 rounded-lg w-3/4" />
        <div className="skeleton h-3 rounded-lg w-1/2" />
        <div className="skeleton h-5 rounded-lg w-1/3" />
        <div className="skeleton h-10 rounded-xl w-full mt-2" />
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade-in">
      <div className="skeleton aspect-square rounded-2xl" />
      <div className="space-y-4">
        <div className="skeleton h-8 rounded-xl w-3/4" />
        <div className="skeleton h-4 rounded-lg w-1/4" />
        <div className="skeleton h-6 rounded-lg w-1/3" />
        <div className="space-y-2 mt-4">
          <div className="skeleton h-3 rounded-lg w-full" />
          <div className="skeleton h-3 rounded-lg w-5/6" />
          <div className="skeleton h-3 rounded-lg w-4/5" />
        </div>
        <div className="skeleton h-12 rounded-xl w-full mt-6" />
      </div>
    </div>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex justify-between">
        <div className="skeleton h-4 rounded-lg w-1/4" />
        <div className="skeleton h-4 rounded-lg w-1/5" />
      </div>
      <div className="skeleton h-3 rounded-lg w-2/5" />
      <div className="flex gap-3">
        <div className="skeleton w-14 h-14 rounded-lg flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-3 rounded-lg w-3/4" />
          <div className="skeleton h-3 rounded-lg w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={`skel-col-${i}`} className="px-4 py-3">
          <div className="skeleton h-4 rounded-lg" />
        </td>
      ))}
    </tr>
  );
}

TableRowSkeleton.propTypes = {
  cols: PropTypes.number,
};

export function PageLoader() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-gold-500/30 border-t-gold-500 animate-spin" />
        <p className="text-dark-400 text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
