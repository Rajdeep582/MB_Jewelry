import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import api from '../services/api';

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = 'Verify Email — M&B Jewelry';
    
    const verifyToken = async () => {
      try {
        const res = await api.get(`/auth/verify/${token}`);
        setStatus('success');
        setMessage(res.data.message);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. Link is invalid or expired.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-dark-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-dark-800 rounded-2xl border border-dark-700 p-8 text-center shadow-2xl"
      >
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-dark-700 border-t-gold-500 rounded-full animate-spin"></div>
            <h2 className="text-xl text-white font-display">Verifying your email...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <FiCheckCircle className="text-5xl text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
            <h2 className="text-2xl text-white font-display">Email Verified!</h2>
            <p className="text-dark-300">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="btn-gold w-full mt-4"
            >
              Sign In to Your Account
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <FiXCircle className="text-5xl text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
            <h2 className="text-2xl text-white font-display">Verification Failed</h2>
            <p className="text-dark-300">{message}</p>
            <Link to="/register" className="text-gold-500 hover:text-gold-400 mt-2">
              Back to Registration
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
