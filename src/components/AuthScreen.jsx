import React, { useState } from 'react';
import { Loader2, Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

const C = { grey: '#394A58', greyDark: '#2a3943', greyDarker: '#1e2830', red: '#CD202C', redHover: '#b31b26' };

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email || !password) {
      setError('Введите email и пароль');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice('На ваш email отправлено письмо для подтверждения. Перейдите по ссылке и вернитесь сюда.');
        }
      }
    } catch (err) {
      setError(err?.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8" style={{ background: `linear-gradient(135deg, ${C.greyDark} 0%, ${C.grey} 50%, ${C.greyDarker} 100%)` }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 text-white">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{ backgroundColor: C.red, fontFamily: 'Archivo, sans-serif' }}>Р</div>
          <div>
            <div className="text-xs font-mono tracking-widest" style={{ color: '#cbd5e1' }}>НАВИГАЦИЯ · АУДИТ</div>
            <div className="text-lg font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>Инспектор ЕНС</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex rounded-xl bg-stone-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signin' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-mono text-stone-500 tracking-widest">EMAIL</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 focus-within:border-stone-400">
                <Mail size={16} className="text-stone-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-stone-900 text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-mono text-stone-500 tracking-widest">ПАРОЛЬ</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 focus-within:border-stone-400">
                <Lock size={16} className="text-stone-400" />
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-stone-900 text-sm"
                  placeholder="не менее 6 символов"
                  minLength={6}
                />
              </div>
            </label>

            {error && (
              <div className="text-sm rounded-xl border px-3 py-2" style={{ borderColor: C.red, color: C.red, backgroundColor: '#fff1f2' }}>
                {error}
              </div>
            )}
            {notice && (
              <div className="text-sm rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-white font-semibold py-3 transition disabled:opacity-60"
              style={{ backgroundColor: C.red }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'signin' ? <LogIn size={18} /> : <UserPlus size={18} />}
              {mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <div className="text-xs font-mono tracking-widest" style={{ color: '#cbd5e1' }}>ПРОТОТИП · МАГИСТЕРСКАЯ ДИССЕРТАЦИЯ</div>
        </div>
      </div>
    </div>
  );
}
