import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Eye, EyeOff, KeyRound, Lock, LogIn, 
  Phone, User, UserPlus, AlertCircle, CheckCircle2, Loader2 
} from 'lucide-react';
import { authAPI } from '../service/api';

const LoginScreen = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [otpStep, setOtpStep] = useState('details'); // 'details' | 'otp'
  const [username, setUsername] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const switchMode = (nextMode) => {
    if (loading) return;
    setMode(nextMode);
    setOtpStep('details');
    setOtp('');
    setDevOtp('');
    clearMessages();
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const response = await authAPI.login({ username, password });
      onAuthenticated(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const response = await authAPI.requestSignupOtp({
        username,
        mobile_no: mobileNo,
        password
      });
      setOtpStep('otp');
      setDevOtp(response.data.devOtp || '');
      setNotice(response.data.message || 'Test OTP generated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const response = await authAPI.verifySignupOtp({
        mobile_no: mobileNo,
        otp
      });
      onAuthenticated(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = isSignup
    ? (otpStep === 'details' ? requestOtp : verifyOtp)
    : handleLogin;

  const inputStyles = "w-full h-12 bg-white border border-slate-200 rounded-lg pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-medium";
  const labelStyles = "block text-[13px] font-semibold text-slate-700 mb-1.5 ml-0.5 uppercase tracking-wider";

  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center px-4 font-sans selection:bg-indigo-100 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-auto"
      >
        {/* Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/80 overflow-hidden w-full max-w-lg flex flex-col">
          
          {/* Brand Header */}
          <div className="px-8 pt-7 pb-5 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-slate-300 shadow-lg shrink-0">
              <Lock className="text-blue-400" size={25} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kayaar ERP</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">Enterprise Resource Management</p>
              <p className="mt-2 text-sm font-semibold text-indigo-700">
                {isSignup ? 'Create account using test OTP verification.' : 'Sign in to continue securely.'}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="px-8 mb-5">
            <div className="flex p-1 bg-slate-100 rounded-xl relative">
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`relative z-10 flex-1 py-2 text-sm font-bold transition-colors duration-200 ${
                    mode === m ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m === 'login' ? 'Login' : 'Sign Up'}
                  {mode === m && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-7 space-y-4 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${otpStep}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3.5"
              >
                {(!isSignup || otpStep === 'details') && (
                  <>
                    <div>
                      <label className={labelStyles}>Username</label>
                      <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className={inputStyles}
                          placeholder="johndoe"
                          required
                        />
                      </div>
                    </div>

                    {isSignup && (
                      <div>
                        <label className={labelStyles}>Mobile Number</label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={mobileNo}
                            onChange={(e) => setMobileNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className={inputStyles}
                            placeholder="98765 43210"
                            inputMode="numeric"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className={labelStyles}>Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type={showPassword ? 'text' : 'password'}
                          className={`${inputStyles} pr-12`}
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 rounded-md transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {isSignup && otpStep === 'otp' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div className="flex gap-3">
                        <CheckCircle2 className="text-indigo-600 shrink-0" size={20} />
                        <div>
                          <p className="text-sm font-bold text-indigo-900">Verify Test OTP</p>
                          <p className="text-xs font-medium text-indigo-700/80 mt-0.5">Use the test code displayed below for {mobileNo}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={labelStyles}>Verification OTP</label>
                      <div className="relative">
                        <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className={`${inputStyles} text-center tracking-[0.5em] font-bold text-lg`}
                          placeholder="000000"
                          inputMode="numeric"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setOtpStep('details'); clearMessages(); }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                    >
                      Edit details?
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Status Messages */}
            <AnimatePresence>
              {devOtp && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-2 text-amber-800 text-sm font-bold">
                  <span className="bg-amber-200 px-1.5 py-0.5 rounded text-[10px]">TEST</span> Test OTP: {devOtp}
                </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-3 text-red-700 text-sm font-medium">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  {error}
                </motion.div>
              )}

              {notice && !error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-start gap-3 text-emerald-700 text-sm font-medium">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  {notice}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="group relative w-full h-12 bg-slate-900 text-white rounded-lg font-bold text-sm uppercase tracking-widest shadow-lg shadow-slate-200 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {!isSignup ? <LogIn size={18} /> : (otpStep === 'details' ? <Phone size={18} /> : <UserPlus size={18} />)}
                    <span>
                      {!isSignup ? 'Sign In' : (otpStep === 'details' ? 'Generate Test OTP' : 'Create Account')}
                    </span>
                  </>
                )}
              </div>
              <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </motion.button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-slate-400 text-xs font-medium">
          &copy; {new Date().getFullYear()} Kayaar Technologies. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
