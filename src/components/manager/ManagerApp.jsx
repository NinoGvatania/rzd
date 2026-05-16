import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Download, Filter, LogOut, Loader2, AlertTriangle, MapPin, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { listAudits } from '../../lib/audits';
import { PARAMETERS, ZONES, ZONE_LABELS, getChecks, isOutOfScope } from '../../lib/audit-rules';

const C = { grey: '#394A58', greyDark: '#2a3943', greyDarker: '#1e2830', red: '#CD202C', black: '#111827' };

export default function ManagerApp({ profile, stations, onSignOut }) {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoneFilter, setZoneFilter] = useState(new Set());
  const [paramFilter, setParamFilter] = useState(new Set());
  const [periodDays, setPeriodDays] = useState(0); // 0 = всё время
  const station = stations.find((s) => s.id === profile.station_id);

  useEffect(() => {
    if (!profile.station_id) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const items = await listAudits({ scope: 'station', stationId: profile.station_id });
      setAudits(items);
      setLoading(false);
    })();
  }, [profile.station_id]);

  const filtered = useMemo(() => {
    const cutoff = periodDays ? Date.now() - periodDays * 86400000 : 0;
    return audits.filter((a) => {
      if (cutoff && a.createdAt < cutoff) return false;
      if (zoneFilter.size && !zoneFilter.has(a.zone)) return false;
      if (paramFilter.size) {
        const fails = getChecks(a).filter((c) => c.status === 'fail');
        const hits = fails.some((c) => paramFilter.has(c.param));
        if (!hits) return false;
      }
      return true;
    });
  }, [audits, zoneFilter, paramFilter, periodDays]);

  const metrics = useMemo(() => calcMetrics(filtered), [filtered]);

  const toggle = (set, val) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  };

  if (!profile.station_id) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: C.grey }}>
        <div className="bg-white rounded-3xl p-6 max-w-sm text-center shadow-2xl">
          <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: C.red }} />
          <div className="text-lg font-bold text-stone-900 mb-1" style={{ fontFamily: 'Archivo, sans-serif' }}>Вокзал не назначен</div>
          <div className="text-sm text-stone-600 mb-4">Обратитесь к администратору, чтобы привязать ваш аккаунт к вокзалу.</div>
          <button onClick={onSignOut} className="text-sm font-mono text-stone-500 tracking-widest">ВЫЙТИ</button>
        </div>
      </div>
    );
  }

  const onExport = () => {
    const lines = ['═══════════════════════════════════════════════',
      'СВОДНЫЙ ОТЧЁТ — РУКОВОДИТЕЛЬ ВОКЗАЛА',
      `Вокзал: ${station?.name ?? '—'}`,
      `Период: ${periodDays ? `последние ${periodDays} дн.` : 'всё время'}`,
      `Дата формирования: ${new Date().toLocaleString('ru-RU')}`,
      '═══════════════════════════════════════════════', '',
      `Всего проверок: ${metrics.total}`,
      `Соответствуют требованиям: ${metrics.ok} (${metrics.compliancePct}%)`,
      `С нарушениями: ${metrics.fail}`, '',
      '─── РАСПРЕДЕЛЕНИЕ ПО ЗОНАМ ───'];
    metrics.byZone.forEach((row) => lines.push(`  ${row.label}: всего ${row.total}, нарушений ${row.fails}`));
    lines.push('', '─── РАСПРЕДЕЛЕНИЕ ПО ПАРАМЕТРАМ ───');
    metrics.byParam.forEach((row) => lines.push(`  ${row.label} ${row.title}: нарушений ${row.fails}`));
    lines.push('', '─── ПЕРЕЧЕНЬ НАРУШЕНИЙ ───');
    filtered.forEach((a, i) => {
      const fails = getChecks(a).filter((c) => c.status === 'fail');
      if (!fails.length || isOutOfScope(a)) return;
      lines.push(`[${i + 1}] ${a.ai?.extracted?.legend_ru || '(без легенды)'} — ${ZONE_LABELS[a.zone] || '—'} — ${new Date(a.createdAt).toLocaleString('ru-RU')}`);
      fails.forEach((c) => lines.push(`    ✗ [${c.rule}, П${c.param}, стр. ${c.page}] ${c.detail}`));
      const recs = a.ai?.recommendations || [];
      if (recs.length) { lines.push('    Рекомендации:'); recs.forEach((r, j) => lines.push(`      ${j + 1}. ${r}`)); }
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `rzd-manager-report-${Date.now()}.txt`;
    link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-stone-100 pb-10">
      <div className="px-5 py-6 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${C.greyDark} 0%, ${C.grey} 60%, ${C.greyDarker} 100%)` }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-xl shadow" style={{ backgroundColor: C.red, fontFamily: 'Archivo, sans-serif' }}>Р</div>
            <div className="flex-1">
              <div className="text-xs font-mono tracking-widest" style={{ color: '#cbd5e1' }}>РУКОВОДИТЕЛЬ ВОКЗАЛА</div>
              <div className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                <Building2 size={18} /> {station?.name ?? '—'}
              </div>
            </div>
            <button onClick={onSignOut} className="text-xs font-mono tracking-widest flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10 transition" style={{ color: '#cbd5e1' }}><LogOut size={14} /> ВЫЙТИ</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-stone-400" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Всего проверок" value={metrics.total} />
              <Metric label="Соответствие" value={`${metrics.compliancePct}%`} tone="ok" />
              <Metric label="Нарушений" value={metrics.fail} tone="fail" />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={16} className="text-stone-500" />
                <div className="text-sm font-semibold text-stone-900">Фильтры</div>
              </div>
              <div className="space-y-3">
                <FilterRow label="Период">
                  {[{ id: 0, lbl: 'Всё' }, { id: 7, lbl: '7 дн' }, { id: 30, lbl: '30 дн' }, { id: 90, lbl: '90 дн' }].map((p) => (
                    <Chip key={p.id} active={periodDays === p.id} onClick={() => setPeriodDays(p.id)}>{p.lbl}</Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Зоны">
                  {ZONES.map((z) => (
                    <Chip key={z.id} active={zoneFilter.has(z.id)} onClick={() => setZoneFilter(toggle(zoneFilter, z.id))}>{z.label}</Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Параметры">
                  {Object.entries(PARAMETERS).map(([id, p]) => (
                    <Chip key={id} active={paramFilter.has(Number(id))} onClick={() => setParamFilter(toggle(paramFilter, Number(id)))} color={p.color}>{p.label}</Chip>
                  ))}
                </FilterRow>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <ChartCard title="Нарушения по зонам">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metrics.byZone}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="fails" radius={[6, 6, 0, 0]}>
                      {metrics.byZone.map((_, i) => (<Cell key={i} fill={C.red} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Нарушения по параметрам">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={metrics.byParam} dataKey="fails" nameKey="label" outerRadius={80} label>
                      {metrics.byParam.map((row, i) => (<Cell key={i} fill={PARAMETERS[row.param]?.color || '#999'} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-stone-900">Аудиты ({filtered.length})</div>
                <button onClick={onExport} className="text-xs font-mono tracking-widest flex items-center gap-1 px-3 py-2 rounded-lg text-white" style={{ backgroundColor: C.black }}>
                  <Download size={14} /> ЭКСПОРТ
                </button>
              </div>
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-400">Под фильтр ничего не попало</div>
              ) : (
                <ul className="divide-y divide-stone-200">
                  {filtered.map((a) => {
                    const checks = getChecks(a);
                    const fails = checks.filter((c) => c.status === 'fail');
                    const warns = checks.filter((c) => c.status === 'warn');
                    const oos = isOutOfScope(a);
                    return (
                      <li key={a.id} className="py-3 flex items-start gap-3">
                        {a.photo && <img src={a.photo} alt="" className="w-14 h-14 rounded-lg object-cover bg-stone-100 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-stone-900 truncate">{a.ai?.extracted?.legend_ru || '(без легенды)'}</div>
                          <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {ZONE_LABELS[a.zone] || '—'}</span>
                            <span>·</span>
                            <span>{new Date(a.createdAt).toLocaleString('ru-RU')}</span>
                          </div>
                          {oos ? (
                            <div className="text-xs text-stone-500 mt-1">Вне области ЕНС</div>
                          ) : (
                            <div className="text-xs mt-1 flex flex-wrap gap-1">
                              {fails.length > 0 && <span className="px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: C.red }}>fail {fails.length}</span>}
                              {warns.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">warn {warns.length}</span>}
                              {fails.length === 0 && warns.length === 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">соответствует</span>}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-stone-300 mt-1" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function calcMetrics(items) {
  const inScope = items.filter((a) => !isOutOfScope(a));
  const ok = inScope.filter((a) => getChecks(a).every((c) => c.status === 'pass')).length;
  const fail = inScope.filter((a) => getChecks(a).some((c) => c.status === 'fail')).length;
  const compliancePct = inScope.length ? Math.round((ok / inScope.length) * 100) : 0;

  const byZoneMap = new Map();
  ZONES.forEach((z) => byZoneMap.set(z.id, { id: z.id, label: z.label, total: 0, fails: 0 }));
  items.forEach((a) => {
    if (!a.zone || !byZoneMap.has(a.zone)) return;
    const row = byZoneMap.get(a.zone);
    row.total += 1;
    if (!isOutOfScope(a) && getChecks(a).some((c) => c.status === 'fail')) row.fails += 1;
  });

  const byParamMap = new Map();
  Object.entries(PARAMETERS).forEach(([id, p]) => byParamMap.set(Number(id), { param: Number(id), label: p.label, title: p.title, fails: 0 }));
  inScope.forEach((a) => {
    getChecks(a).filter((c) => c.status === 'fail').forEach((c) => {
      const row = byParamMap.get(c.param); if (row) row.fails += 1;
    });
  });

  return {
    total: items.length,
    ok, fail, compliancePct,
    byZone: Array.from(byZoneMap.values()),
    byParam: Array.from(byParamMap.values()),
  };
}

function Metric({ label, value, tone }) {
  const color = tone === 'ok' ? '#059669' : tone === 'fail' ? C.red : C.black;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'Archivo, sans-serif', color }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
      <div className="text-sm font-semibold text-stone-900 mb-3">{title}</div>
      {children}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div>
      <div className="text-xs font-mono text-stone-500 tracking-widest mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children, color }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full border text-xs font-semibold transition"
      style={active
        ? { backgroundColor: color || C.red, borderColor: color || C.red, color: 'white' }
        : { backgroundColor: 'white', borderColor: '#d6d3d1', color: '#1c1917' }}>
      {children}
    </button>
  );
}
