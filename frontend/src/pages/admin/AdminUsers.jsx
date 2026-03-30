import { useEffect, useState } from 'react';
import { FiSearch, FiUserX, FiUserCheck } from 'react-icons/fi';
import { userService } from '../../services/services';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  useEffect(() => { document.title = 'Users — Admin'; }, []);

  const loadUsers = async () => {
    setLoading(true);
    const res = await userService.getAllUsers({ page, limit: 20 });
    setUsers(res.data.users);
    setTotal(res.data.total);
    setPages(res.data.pages);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, [page]);

  const handleToggle = async (id, name) => {
    try {
      const res = await userService.toggleUserActive(id);
      toast.success(`${name} ${res.data.user.isActive ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch {
      toast.error('Failed to update user');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-white">Users</h1>
        <p className="text-dark-400 text-sm">{total} registered users</p>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-dark-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">User</th>
                <th className="text-left py-2 pr-4">Role</th>
                <th className="text-left py-2 pr-4">Joined</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="py-3"><div className="skeleton h-8 rounded-lg" /></td></tr>
                ))
              ) : users.map((user) => (
                <tr key={user._id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 text-sm font-bold flex-shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm">{user.name}</p>
                        <p className="text-dark-500 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${user.role === 'admin' ? 'badge-gold' : 'bg-dark-700 text-dark-400 border border-white/10'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-dark-500 text-xs">{formatDate(user.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${user.isActive ? 'badge-green' : 'badge-red'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleToggle(user._id, user.name)}
                        className={`p-2 transition-colors ${user.isActive ? 'text-dark-400 hover:text-red-400' : 'text-dark-400 hover:text-green-400'}`}
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {user.isActive ? <FiUserX size={14} /> : <FiUserCheck size={14} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs ${p === page ? 'bg-gold-500 text-dark-900' : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
