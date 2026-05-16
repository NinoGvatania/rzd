import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Lock, LogIn, UserPlus, ShieldCheck, Building2, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { listStations } from '../lib/stations';
import { createProfile } from '../lib/profile';

const C = { grey: '#394A58', greyDark: '#2a3943', greyDarker: '#1e2830', red: '#CD202C' };

const ROLES = [
  { id: 'inspector', label: 'Инспектор',           icon: ClipboardList, hint: 'Проводит проверки на местах' },
  { id: 'manager',   label: 'Руководитель вокзала', icon: Building2,     hint: 'Видит сводку по своему вокзалу' },
  { id: 'admin',     label: 'Администратор',        icon: ShieldCheck,   hint: 'Управляет справочниками и доступом' },
];

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('inspector');
  const [stationId, setStationId] = useState('');
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (mode === 'signup' && stations.length === 0) {
      listStations().then(setStations);
    }
  }, [mode, stations.length]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email || !password) { setError('Введите email и пароль'); return; }
    if (mode === 'signup' && role === 'manager' && !stationId) {
      setError('Выберите вокзал для роли «Руководитель»'); return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Если сессия сразу есть (confirm email отключён) — создаём профиль.
        // Если confirm email включён — профиль создастся при первом входе, см. App.jsx.
        if (data.session) {
          try {
            await createProfile({ role, stationId: stationId || null, fullName: fullName || null });
          } catch (err) {
            setError('Не удалось сохранить профиль: ' + (err?.message || err));
            return;
          }
          // Кладём pending-данные в localStorage на случай если confirm email перехватит сессию.
        } else {
          // Сохраним выбор роли/вокзала локально — после подтверждения почты подхватим.
          localStorage.setItem('pending_profile', JSON.stringify({ role, stationId: stationId || null, fullName: fullName || null }));
          setNotice('На email отправлено письмо для подтверждения. Перейдите по ссылке и вернитесь сюда.');
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
            <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signin' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}>Вход</button>
            <button type="button" onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}>Регистрация</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-mono text-stone-500 tracking-widest">EMAIL</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 focus-within:border-stone-400">
                <Mail size={16} className="text-stone-400" />
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-stone-900 text-sm" placeholder="name@example.com" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-mono text-stone-500 tracking-widest">ПАРОЛЬ</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 focus-within:border-stone-400">
                <Lock size={16} className="text-stone-400" />
                <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-stone-900 text-sm" placeholder="не менее 6 символов" minLength={6} />
              </div>
            </label>

            {mode === 'signup' && (
              <>
                <label className="block">
                  <span className="text-xs font-mono text-stone-500 tracking-widest">ФИО (опционально)</span>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-stone-900 text-sm outline-none focus:border-stone-400" placeholder="Иванов И. И." />
                </label>

                <div>
                  <div className="text-xs font-mono text-stone-500 tracking-widest mb-1">РОЛЬ</div>
                  <div className="grid gap-2">
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      const active = role === r.id;
                      return (
                        <button key={r.id} type="button" onClick={() => setRole(r.id)}
                          className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${active ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                          <Icon size={18} className={active ? 'text-stone-900' : 'text-stone-400'} />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-stone-900">{r.label}</div>
                            <div className="text-xs text-stone-500">{r.hint}</div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 mt-0.5 ${active ? 'border-stone-900' : 'border-stone-300'}`}>
                            {active && <div className="w-full h-full rounded-full" style={{ backgroundColor: C.red }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {role === 'manager' && (
                  <label className="block">
                    <span className="text-xs font-mono text-stone-500 tracking-widest">ВОКЗАЛ</span>
                    <select value={stationId} onChange={(e) => setStationId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-stone-900 text-sm outline-none focus:border-stone-400">
                      <option value="">— выберите —</option>
                      {stations.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </label>
                )}
              </>
            )}

            {error && <div className="text-sm rounded-xl border px-3 py-2" style={{ borderColor: C.red, color: C.red, backgroundColor: '#fff1f2' }}>{error}</div>}
            {notice && <div className="text-sm rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">{notice}</div>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-white font-semibold py-3 transition disabled:opacity-60"
              style={{ backgroundColor: C.red }}>
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
