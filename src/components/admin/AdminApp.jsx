import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogOut, Loader2, Plus, Trash2, Pencil, Save, X, Users, Building2, History, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { listStations, createStation, updateStation, deleteStation } from '../../lib/stations';

const C = { grey: '#394A58', greyDark: '#2a3943', greyDarker: '#1e2830', red: '#CD202C', black: '#111827' };

const TABS = [
  { id: 'stations', label: 'Вокзалы',       icon: Building2 },
  { id: 'users',    label: 'Пользователи',  icon: Users },
  { id: 'log',      label: 'Журнал',        icon: History },
  { id: 'monitor',  label: 'Мониторинг',    icon: Database },
];

export default function AdminApp({ profile, stations: initialStations, onSignOut }) {
  const [tab, setTab] = useState('stations');
  const [stations, setStations] = useState(initialStations);

  const refreshStations = async () => setStations(await listStations());

  return (
    <div className="min-h-screen bg-stone-100 pb-10">
      <div className="px-5 py-6 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${C.greyDark} 0%, ${C.grey} 60%, ${C.greyDarker} 100%)` }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-xl shadow" style={{ backgroundColor: C.red, fontFamily: 'Archivo, sans-serif' }}>Р</div>
            <div className="flex-1">
              <div className="text-xs font-mono tracking-widest" style={{ color: '#cbd5e1' }}>АДМИНИСТРАТОР</div>
              <div className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                <ShieldCheck size={18} /> Управление системой
              </div>
            </div>
            <button onClick={onSignOut} className="text-xs font-mono tracking-widest flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10 transition" style={{ color: '#cbd5e1' }}><LogOut size={14} /> ВЫЙТИ</button>
          </div>
          <div className="mt-5 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono tracking-widest transition whitespace-nowrap"
                  style={active ? { backgroundColor: 'white', color: C.black } : { color: '#cbd5e1', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <Icon size={14} /> {t.label.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {tab === 'stations' && <StationsTab stations={stations} onRefresh={refreshStations} />}
        {tab === 'users' && <UsersTab stations={stations} currentUserId={profile.id} />}
        {tab === 'log' && <LogTab />}
        {tab === 'monitor' && <MonitorTab />}
      </div>
    </div>
  );
}

function StationsTab({ stations, onRefresh }) {
  const [editing, setEditing] = useState(null); // null | 'new' | station.id
  const [form, setForm] = useState({ name: '', code: '', city: '', latitude: '', longitude: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startNew = () => { setEditing('new'); setForm({ name: '', code: '', city: '', latitude: '', longitude: '' }); setError(''); };
  const startEdit = (s) => { setEditing(s.id); setForm({ name: s.name || '', code: s.code || '', city: s.city || '', latitude: s.latitude ?? '', longitude: s.longitude ?? '' }); setError(''); };
  const cancel = () => { setEditing(null); setError(''); };

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Название обязательно'); return; }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      city: form.city.trim() || null,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
    };
    setBusy(true);
    try {
      if (editing === 'new') {
        await createStation(payload);
        await logAction('station.create', payload.name, payload);
      } else {
        await updateStation(editing, payload);
        await logAction('station.update', payload.name, { id: editing, ...payload });
      }
      await onRefresh();
      setEditing(null);
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally { setBusy(false); }
  };

  const remove = async (s) => {
    if (!confirm(`Удалить «${s.name}»?`)) return;
    try {
      await deleteStation(s.id);
      await logAction('station.delete', s.name, { id: s.id });
      await onRefresh();
    } catch (e) { alert(e?.message || 'Не удалось удалить'); }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-stone-900">Справочник вокзалов ({stations.length})</div>
        {editing == null && (
          <button onClick={startNew} className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-mono tracking-widest" style={{ backgroundColor: C.red }}>
            <Plus size={14} /> ДОБАВИТЬ
          </button>
        )}
      </div>

      {editing != null && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <Input label="Название" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Код" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <Input label="Город" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <div />
            <Input label="Широта" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} />
            <Input label="Долгота" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} />
          </div>
          {error && <div className="text-xs mt-2" style={{ color: C.red }}>{error}</div>}
          <div className="flex gap-2 mt-3">
            <button disabled={busy} onClick={submit} className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-mono tracking-widest disabled:opacity-60" style={{ backgroundColor: C.black }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} СОХРАНИТЬ
            </button>
            <button onClick={cancel} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-stone-200 text-xs font-mono tracking-widest"><X size={14} /> ОТМЕНА</button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-stone-200">
        {stations.map((s) => (
          <li key={s.id} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-stone-900 truncate">{s.name}</div>
              <div className="text-xs text-stone-500">{[s.code, s.city, s.latitude != null && s.longitude != null ? `${s.latitude.toFixed(3)}, ${s.longitude.toFixed(3)}` : null].filter(Boolean).join(' · ')}</div>
            </div>
            <button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-stone-100" title="Редактировать"><Pencil size={14} /></button>
            <button onClick={() => remove(s)} className="p-2 rounded-lg hover:bg-stone-100" title="Удалить"><Trash2 size={14} style={{ color: C.red }} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsersTab({ stations, currentUserId }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, station_id, full_name, blocked, created_at')
        .order('created_at', { ascending: false });
      if (!error) setProfiles(data || []);
      setLoading(false);
    })();
  }, []);

  const stationName = (id) => stations.find((s) => s.id === id)?.name || '—';

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
      <div className="text-sm font-semibold text-stone-900 mb-3">Пользователи ({profiles.length})</div>
      <div className="text-xs text-stone-500 mb-3">Управление паролями и блокировка временно недоступны — будут добавлены, когда настроим service_role на сервере.</div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : (
        <ul className="divide-y divide-stone-200">
          {profiles.map((p) => (
            <li key={p.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-900 truncate">{p.full_name || '(без имени)'}{p.id === currentUserId && <span className="text-xs text-stone-400 ml-2">— это вы</span>}</div>
                <div className="text-xs text-stone-500">{p.role} · {p.role === 'manager' ? stationName(p.station_id) : '—'} · {new Date(p.created_at).toLocaleDateString('ru-RU')}</div>
              </div>
              {p.blocked && <span className="px-2 py-0.5 text-xs rounded-full text-white" style={{ backgroundColor: C.red }}>blocked</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('id, action, target, details, created_at, actor_id')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error) setEntries(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
      <div className="text-sm font-semibold text-stone-900 mb-3">Журнал действий (последние 100)</div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-stone-500 py-8 text-center">Действий пока нет</div>
      ) : (
        <ul className="divide-y divide-stone-200">
          {entries.map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="text-xs font-mono text-stone-500">{new Date(e.created_at).toLocaleString('ru-RU')}</div>
              <div className="text-sm font-semibold text-stone-900">{e.action} <span className="font-normal text-stone-600">— {e.target || ''}</span></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonitorTab() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
      <div className="text-sm font-semibold text-stone-900 mb-2">Мониторинг и диагностика</div>
      <div className="text-sm text-stone-600 mb-3">
        Логи Supabase, метрики БД и времена отклика доступны в Supabase Dashboard. Открой проект в Supabase → раздел Logs / Reports.
      </div>
      <a className="inline-flex items-center gap-1 text-sm font-semibold underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
        Открыть Supabase Dashboard →
      </a>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-mono text-stone-500 tracking-widest">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-stone-500" />
    </label>
  );
}

async function logAction(action, target, details) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from('admin_actions').insert({
    actor_id: u?.user?.id,
    action,
    target,
    details,
  });
}
