import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, X, AlertTriangle, ChevronRight, ChevronLeft, Trash2, Download, Ruler, Home, ClipboardCheck, Upload, Sparkles, Loader2, Eye, Lightbulb, RotateCcw, FileCheck, Pencil, Save, Plus, MessageSquare } from 'lucide-react';
import { listAudits, saveAudit, deleteAuditById } from './lib/audits';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';

// Брендовые цвета РЖД (inline-style, т.к. Tailwind в артефактах не компилит arbitrary values)
const C = { grey: '#394A58', greyDark: '#2a3943', greyDarker: '#1e2830', red: '#CD202C', redHover: '#b31b26', black: '#111827' };

const DISTANCES = [
  { id: '<10', label: 'до 10 м', minX: 36 },
  { id: '10-15', label: '10–15 м', minX: 48 },
  { id: '15-20', label: '15–20 м', minX: 48 },
  { id: '>20', label: 'более 20 м', minX: 64 }
];
const PARAMETERS = {
  1: { label: 'П1', title: 'Визуальные стандарты', color: '#6366F1', bg: '#EEF2FF' },
  2: { label: 'П2', title: 'Пространственная логика', color: '#0891B2', bg: '#ECFEFF' },
  3: { label: 'П3', title: 'Семантическая достаточность', color: '#8B5CF6', bg: '#F5F3FF' },
  4: { label: 'П4', title: 'Доступность', color: '#059669', bg: '#ECFDF5' },
  5: { label: 'П5', title: 'Актуальность', color: '#EA580C', bg: '#FFF7ED' }
};
const RULE_META = {
  bilingual: { title: 'Двуязычность', page: 14, param: 1 },
  color_palette: { title: 'Цветовая палитра', page: 13, param: 1 },
  fields_layout: { title: 'Структура и пропорции полей', page: 17, param: 1 },
  info_priority: { title: 'Приоритет информации', page: 7, param: 3 },
  sign_typology: { title: 'Типология указателя', page: 9, param: 3 },
  typography: { title: 'Гарнитура FSRailway Book', page: 14, param: 1 },
  font_size_adequacy: { title: 'Размер шрифта для дистанции', page: 8, param: 2 }
};

// ─────────────────────────────────────────────────────────
// AI-АНАЛИЗ с улучшенным промптом
// ─────────────────────────────────────────────────────────
async function analyzeWithAI(base64Image, mediaType, distanceId) {
  const d = DISTANCES.find(x => x.id === distanceId);
  const prompt = `Ты эксперт по «Руководству по применению единой навигационной системы для вокзалов и остановочных пунктов холдинга РЖД» (2013). Проведи аудит фотографии навигационного указателя.

ПРИНЦИП: будь точным. Если видишь явное соответствие стандарту — ставь PASS уверенно. Если видишь явное нарушение — ставь FAIL с обоснованием. НЕ ИСПОЛЬЗУЙ формулировки "требует сверки с макетами", "может быть нарушением", "потенциально". Если не уверен — ставь PASS.

═══ ⚠️ СНАЧАЛА — КЛАССИФИКАЦИЯ КАТЕГОРИИ УКАЗАТЕЛЯ ═══

Прежде чем оценивать правила, определи, К КАКОЙ КАТЕГОРИИ ОТНОСИТСЯ ЗНАК:

🟢 "navigation" — ПАССАЖИРСКАЯ НАВИГАЦИЯ ЕНС
Большие указатели с серыми и/или красными полями, направления к поездам/выходам/кассам/туалетам, планы вокзала, стелы. Это и есть предмет Руководства. Только такие знаки оцениваются по 7 правилам.

🟡 "functional" — ФУНКЦИОНАЛЬНЫЙ ЗНАК ПО ISO 7010
На стр. 13 Руководства прямо сказано: существует функциональная палитра для функциональных знаков по стандарту BS ISO 7010:2011. Это:
• Жёлтые знаки — ПРЕДУПРЕЖДЕНИЕ (высокое напряжение, опасная зона, номер тоннеля/пути для персонала, внимание и т.д.)
• Красные знаки — средства пожарной безопасности или запрещающие (огнетушитель, не курить, проход запрещён)
• Синие знаки — предписывающие (надеть жилет, идти пешком)
• Зелёные знаки — эвакуация, аптечки, пункты первой помощи
ТАКИЕ ЗНАКИ ЯВЛЯЮТСЯ ДОПУСТИМЫМИ И НЕ ЯВЛЯЮТСЯ НАРУШЕНИЯМИ ЕНС. Их не оценивают по правилам корпоративной палитры.

⚫ "service" — СЛУЖЕБНЫЙ/ВЕДОМСТВЕННЫЙ ЗНАК
Таблички для персонала, номера технических помещений, маркировка оборудования. Находятся вне сферы ЕНС.

❓ "other" — НЕ РЖД или не определено

ЕСЛИ категория НЕ "navigation", то все 7 правил ЕНС НЕПРИМЕНИМЫ. Ставь всем правилам status="pass" и в reasoning честно пиши: "Правило неприменимо — указатель относится к категории [functional/service/other]".

═══ ЭТАЛОННАЯ СТРУКТУРА ПАССАЖИРСКОГО УКАЗАТЕЛЯ (только для "navigation") ═══

Стандартный указатель направления (тип B) — это ГОРИЗОНТАЛЬНЫЙ прямоугольник:
• СВЕРХУ: крупное СЕРОЕ поле (#394A58) с первичной информацией — текст, стрелки, пиктограммы БЕЛОГО цвета
• СНИЗУ: узкая КРАСНАЯ ПОЛОСА (#CD202C) с вторичной информацией — текст БЕЛОГО цвета
Это НОРМА. Не считай красную полосу "декоративным элементом" — это штатное поле вторичной информации.

Если на одном фото несколько указателей, один с красной полосой другой без — ТОТ С КРАСНОЙ ПОЛОСОЙ СООТВЕТСТВУЕТ СТАНДАРТУ. Сравнивай остальные с ним.

Указатель ТОЛЬКО с серым полем без красной полосы (при типе B с вторичной информацией) — нарушение структуры (fields_layout).

═══ 7 ПРАВИЛ ПРОВЕРКИ (применяются только если category="navigation") ═══

ПРАВИЛО 1 — ДВУЯЗЫЧНОСТЬ (стр. 14)
Русский + английский (Oblique, 75% высоты русского). Если нет перевода → FAIL. Если есть, но визуально сильно меньше 75% или явно прямое начертание вместо курсива → WARN с конкретикой.

ПРАВИЛО 2 — ЦВЕТОВАЯ ПАЛИТРА (стр. 13)
Допустимы ТОЛЬКО: RZD-Grey (#394A58), RZD-Red (#CD202C), White.
Красная полоса на указателе = норма, НЕ декоративный элемент. Не отмечай её как сомнительную.
Другие цвета (кроме знаков аварийной безопасности) → FAIL.

ПРАВИЛО 3 — СТРУКТУРА И ПРОПОРЦИИ (стр. 17-18) ⚠️ КРИТИЧНО
Указатели типа B (направление) и C (информирование) ОБЯЗАНЫ иметь ДВА элемента:
1. СЕРОЕ поле сверху (первичная информация)
2. КРАСНАЯ ПОЛОСА снизу (вторичная информация)
Красная полоса — СТРУКТУРНЫЙ элемент, а не опциональный. Она ДОЛЖНА присутствовать ДАЖЕ ЕСЛИ ПУСТА (без текста/пиктограмм). Отсутствие красной полосы на указателе B/C — АВТОМАТИЧЕСКИ FAIL по этому правилу, независимо от того, какая информация размещена.
Проверь ВИЗУАЛЬНО: есть ли внизу указателя красная горизонтальная полоса? Если нет — FAIL с пояснением "отсутствует обязательная красная полоса".
Панели одинаковой высоты и ширины. Запрещено: разные габариты, изменение пропорций, вертикальная стыковка, вращение.

ПРАВИЛО 4 — ПРИОРИТЕТ ИНФОРМАЦИИ (стр. 7)

ПЕРВИЧНАЯ (должна быть на СЕРОМ поле):
• направления к поездам и путям
• направления к выходам
• кассы и кассовые залы
• справочная и расписания
• туалеты
• лифты, эскалаторы, этажи
• камеры хранения
• комнаты матери и ребёнка, полиции
• услуги для МГН

ВТОРИЧНАЯ (должна быть на КРАСНОМ поле):
• залы ожидания, комнаты отдыха
• городской транспорт, метро, автобусы
• такси, парковка
• торговля, кафе, рестораны
• банкоматы, обмен валюты
• медпункты, багажные отделения

ОСОБЫЙ СЛУЧАЙ — АДМИНИСТРАЦИЯ:
«Начальник вокзала», «Администрация вокзала», «Сотрудники», «Военный комендант» — в практике применения РЖД часто выносятся как оперативно-значимые объекты и размещаются на СЕРОМ поле. Если эти объекты размещены на сером — ставь PASS. Не считай нарушением. Размещение на красном — тоже допустимо.

ТРЕТИЧНАЯ (в планах/схемах, в указателях при наличии места):
• религиозные объекты
• почтовые отделения, телефоны

Если первичная на красном / вторичная на сером / третичная не в том месте → FAIL с конкретикой.

ПРАВИЛО 5 — ТИПОЛОГИЯ (стр. 9)
Тип A: объект (без стрелок). Тип B: направление (со стрелкой ОБЯЗАТЕЛЬНО). Тип C: информирование (план/схема/стела).

ПРАВИЛО 6 — ГАРНИТУРА (стр. 14)
FSRailway Book — прямой гротеск без засечек. Английский — Oblique. Нарушения: засечки, курсив русского, ВСЕ ЗАГЛАВНЫЕ, искажения.

ПРАВИЛО 7 — РАЗМЕР ШРИФТА (стр. 8)
Дистанция: ${d.label}. Мин. X = ${d.minX} мм. Если явно мал → FAIL. Если адекватен → PASS.

═══ ФОРМАТ ОТВЕТА ═══

Верни СТРОГО JSON без markdown:

{
  "is_rzd_sign": true/false,
  "category": "navigation" | "functional" | "service" | "other",
  "category_note": "если не navigation — краткое пояснение, что это за знак",
  "extracted": {
    "legend_ru": "все русские надписи через запятую",
    "legend_en": "все английские надписи через запятую",
    "sign_type": "A" | "B" | "C",
    "has_gray_field": true/false,
    "has_red_field": true/false,
    "has_arrow": true/false,
    "has_pictogram": true/false,
    "what_i_see": "1-2 предложения о том, что именно на фото"
  },
  "rules": {
    "bilingual": {"status": "pass/warn/fail", "reasoning": "конкретно что увидел"},
    "color_palette": {"status": "pass/warn/fail", "reasoning": "..."},
    "fields_layout": {"status": "pass/warn/fail", "reasoning": "..."},
    "info_priority": {"status": "pass/warn/fail", "reasoning": "..."},
    "sign_typology": {"status": "pass/warn/fail", "reasoning": "..."},
    "typography": {"status": "pass/warn/fail", "reasoning": "..."},
    "font_size_adequacy": {"status": "pass/warn/fail", "reasoning": "..."}
  },
  "summary": "главная проблема в 1 предложении (или 'Знак соответствует своей категории' если не ЕНС)",
  "recommendations": ["конкретная рекомендация 1", "конкретная рекомендация 2"]
}

Если на фото НЕ указатель РЖД: is_rzd_sign=false, category="other".
Если указатель ЕСТЬ но это НЕ пассажирская навигация (например, жёлтый предупреждающий знак с номером тоннеля): is_rzd_sign=true, category="functional"/"service", все rules ставь "pass" с пояснением "правило неприменимо — указатель не относится к ЕНС".`;

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mediaType, prompt })
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  const data = await res.json();
  const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
  return JSON.parse(clean);
}

function getChecks(audit) {
  const rules = audit.ai?.rules || {};
  return Object.entries(RULE_META).map(([key, meta]) => {
    const r = rules[key];
    return { key, status: r?.status || 'pass', rule: meta.title, detail: r?.reasoning || 'Нет данных', page: meta.page, param: meta.param };
  });
}

// Хранилище (Supabase) — реэкспорт для совместимости с остальным кодом
const loadAudits = listAudits;
const deleteAudit = deleteAuditById;

// ─────────────────────────────────────────────────────────
// UI ПРИМИТИВЫ
// ─────────────────────────────────────────────────────────
const Btn = ({ onClick, children, variant = 'primary', disabled, icon: Icon, className = '', style = {} }) => {
  const base = 'inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-lg';
  const variants = {
    primary: { backgroundColor: C.grey, color: 'white' },
    danger: { backgroundColor: C.red, color: 'white' },
    dark: { backgroundColor: C.black, color: 'white' },
    light: { backgroundColor: 'white', color: C.black, border: '1px solid #d6d3d1' }
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...variants[variant], ...style }} className={`${base} ${className}`}>{Icon && <Icon size={18} />}{children}</button>;
};

const Header = ({ title, subtitle, onBack, right }) => (
  <div className="sticky top-0 z-10 backdrop-blur-md border-b border-stone-300" style={{ backgroundColor: 'rgba(245, 245, 244, 0.95)' }}>
    <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
      {onBack && <button onClick={onBack} className="p-2 -ml-2 text-stone-700 hover:bg-stone-200 rounded-lg"><ChevronLeft size={22} /></button>}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-stone-900 truncate" style={{ fontFamily: 'Archivo, sans-serif', letterSpacing: '-0.01em' }}>{title}</h1>
        {subtitle && <p className="text-xs text-stone-600 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  </div>
);

const BottomBar = ({ children }) => (
  <div className="fixed bottom-0 inset-x-0 border-t-2 shadow-2xl" style={{ backgroundColor: C.greyDarker, borderTopColor: '#44444a' }}>
    <div className="max-w-xl mx-auto p-4">{children}</div>
  </div>
);

// ─────────────────────────────────────────────────────────
// ГЛАВНЫЙ ЭКРАН
// ─────────────────────────────────────────────────────────
function ScreenHome({ onNew, onJournal, auditCount, stats, onSignOut }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="max-w-xl mx-auto px-5 py-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{ backgroundColor: C.red, fontFamily: 'Archivo, sans-serif' }}>Р</div>
          <div className="flex-1">
            <div className="text-xs font-mono text-stone-500 tracking-widest">НАВИГАЦИЯ · АУДИТ</div>
            <div className="text-lg font-bold text-stone-900" style={{ fontFamily: 'Archivo, sans-serif' }}>Инспектор ЕНС</div>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} className="text-xs font-mono text-stone-500 hover:text-stone-900 tracking-widest px-3 py-2 rounded-lg hover:bg-stone-200 transition">ВЫЙТИ</button>
          )}
        </div>
        <div className="relative overflow-hidden rounded-3xl p-6 mb-5 text-white shadow-xl" style={{ background: `linear-gradient(135deg, ${C.greyDark} 0%, ${C.grey} 50%, ${C.greyDarker} 100%)` }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-40 -translate-y-8 translate-x-8" style={{ backgroundColor: C.red }}></div>
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest mb-3 px-2.5 py-1 rounded-full border border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
              <Sparkles size={12} /> AI-АНАЛИЗ · РУЧНАЯ ПРАВКА
            </div>
            <h2 className="text-2xl font-bold leading-tight mb-1 text-white" style={{ fontFamily: 'Archivo, sans-serif' }}>Проверка указателей</h2>
            <p className="text-sm mb-5" style={{ color: '#cbd5e1' }}>Фото → автоанализ → корректировка эксперта</p>
            <Btn onClick={onNew} variant="danger" icon={Camera} className="w-full" style={{ paddingTop: 16, paddingBottom: 16, fontSize: 16 }}>НАЧАТЬ ПРОВЕРКУ</Btn>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <div className="text-xs text-stone-500 mb-1">Всего</div>
            <div className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'Archivo, sans-serif' }}>{stats.total}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <div className="text-xs text-stone-500 mb-1">OK</div>
            <div className="text-2xl font-bold text-emerald-600" style={{ fontFamily: 'Archivo, sans-serif' }}>{stats.ok}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <div className="text-xs text-stone-500 mb-1">Нарушений</div>
            <div className="text-2xl font-bold" style={{ color: C.red, fontFamily: 'Archivo, sans-serif' }}>{stats.fail}</div>
          </div>
        </div>
        <button onClick={onJournal} className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 hover:bg-stone-50 transition-all text-left shadow-sm border border-stone-200">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: C.black }}><ClipboardCheck size={22} /></div>
          <div className="flex-1">
            <div className="font-semibold text-stone-900">Журнал проверок</div>
            <div className="text-xs text-stone-500">{auditCount} записей · экспорт отчёта</div>
          </div>
          <ChevronRight className="text-stone-400" size={20} />
        </button>
        <div className="mt-6 text-center">
          <div className="text-xs font-mono text-stone-400 tracking-widest">ПРОТОТИП · МАГИСТЕРСКАЯ ДИССЕРТАЦИЯ</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ЭКРАН АНАЛИЗА
// ─────────────────────────────────────────────────────────
function ScreenAnalyze({ onBack, onDone }) {
  const [photo, setPhoto] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState('image/jpeg');
  const [distance, setDistance] = useState(null);
  const [phase, setPhase] = useState('input');
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handlePhoto = e => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotoMediaType(f.type || 'image/jpeg');
    const r = new FileReader();
    r.onload = () => setPhoto(r.result);
    r.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!photo || !distance) return;
    setPhase('analyzing'); setError(null);
    try {
      const base64 = photo.split(',')[1];
      const ai = await analyzeWithAI(base64, photoMediaType, distance);
      if (ai.is_rzd_sign === false) { setError('На фото не обнаружен навигационный указатель РЖД. Загрузите другое фото.'); setPhase('error'); return; }
      const audit = { id: `a-${Date.now()}`, createdAt: Date.now(), photo, distance, ai };
      await saveAudit(audit);
      onDone(audit);
    } catch (e) { console.error(e); setError('Не удалось проанализировать фото. Возможно, проблема с сетью.'); setPhase('error'); }
  };

  return (
    <div className="min-h-screen bg-stone-100 pb-32">
      <Header title="Новая проверка" subtitle="Загрузи фото — AI разберёт сам" onBack={onBack} />
      <div className="max-w-xl mx-auto px-5 py-5">
        <div className="mb-6">
          <div className="text-xs font-mono text-stone-600 tracking-widest mb-2">ШАГ 1 · ФОТО УКАЗАТЕЛЯ</div>
          <div className="aspect-[4/3] rounded-2xl overflow-hidden relative border-2 border-stone-300" style={{ backgroundColor: C.black }}>
            {photo ? <img src={photo} alt="Указатель" className="w-full h-full object-cover" /> : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400">
                <Upload size={40} className="mb-2" /><div className="text-sm">Фото появится здесь</div>
              </div>
            )}
            <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-white opacity-70"></div>
            <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-white opacity-70"></div>
            <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-white opacity-70"></div>
            <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-white opacity-70"></div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <Btn onClick={() => fileRef.current?.click()} variant="dark" icon={Camera} className="w-full mt-3">{photo ? 'ЗАМЕНИТЬ ФОТО' : 'СДЕЛАТЬ ФОТО / ЗАГРУЗИТЬ'}</Btn>
        </div>
        <div className="mb-5">
          <div className="text-xs font-mono text-stone-600 tracking-widest mb-2">ШАГ 2 · ДИСТАНЦИЯ ДО УКАЗАТЕЛЯ</div>
          <div className="text-xs text-stone-600 mb-3 flex items-start gap-1.5">
            <Ruler size={13} className="mt-0.5 shrink-0" />
            <span>Единственное, что нельзя определить по фото</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DISTANCES.map(d => {
              const active = distance === d.id;
              return <button key={d.id} onClick={() => setDistance(d.id)} className="py-3.5 px-4 rounded-xl border-2 text-sm font-bold transition-all shadow-sm" style={active ? { backgroundColor: C.red, borderColor: C.red, color: 'white' } : { backgroundColor: 'white', borderColor: '#d6d3d1', color: '#1c1917' }}>
                {d.label}<div className="text-xs font-mono mt-0.5" style={{ color: active ? '#fecaca' : '#78716c' }}>X ≥ {d.minX} мм</div>
              </button>;
            })}
          </div>
        </div>
        {phase === 'error' && <div className="rounded-xl p-4 flex gap-3 text-sm mb-4 shadow-sm" style={{ backgroundColor: '#FEF2F2', border: '2px solid #FCA5A5', color: '#7F1D1D' }}><AlertTriangle size={18} className="shrink-0 mt-0.5" /><div>{error}</div></div>}
        {phase === 'analyzing' && (
          <div className="rounded-2xl p-8 text-white text-center shadow-xl" style={{ background: `linear-gradient(135deg, ${C.greyDark}, ${C.greyDarker})` }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 border border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}><Loader2 size={32} className="animate-spin" /></div>
            <div className="text-base font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>AI анализирует фото…</div>
            <div className="text-xs font-mono tracking-widest" style={{ color: '#94a3b8' }}>ПРОВЕРКА ПО 7 ПРАВИЛАМ</div>
          </div>
        )}
      </div>
      {phase !== 'analyzing' && (
        <BottomBar>
          <Btn onClick={analyze} disabled={!photo || !distance} variant="danger" icon={Sparkles} className="w-full" style={{ paddingTop: 16, paddingBottom: 16, fontSize: 16 }}>ПРОАНАЛИЗИРОВАТЬ</Btn>
          {(!photo || !distance) && <div className="text-xs text-center mt-2 font-mono" style={{ color: '#94a3b8' }}>{!photo && !distance ? 'Нужны фото и дистанция' : !photo ? 'Нужно фото' : 'Укажи дистанцию'}</div>}
        </BottomBar>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// РЕЗУЛЬТАТ С РЕДАКТИРОВАНИЕМ
// ─────────────────────────────────────────────────────────
function ScreenResult({ audit, onHome, onNew, onUpdate }) {
  const [showAI, setShowAI] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(audit))); // глубокая копия
  const [comment, setComment] = useState(audit.personalComment || '');
  const [commentSaved, setCommentSaved] = useState(false);

  useEffect(() => { setDraft(JSON.parse(JSON.stringify(audit))); setComment(audit.personalComment || ''); }, [audit.id]);

  const saveComment = async () => {
    if (comment === (audit.personalComment || '')) return;
    const updated = { ...audit, personalComment: comment };
    await saveAudit(updated);
    onUpdate(updated);
    setCommentSaved(true);
    setTimeout(() => setCommentSaved(false), 1800);
  };

  const checks = getChecks(editMode ? draft : audit);
  const fails = checks.filter(c => c.status === 'fail');
  const warns = checks.filter(c => c.status === 'warn');
  const passes = checks.filter(c => c.status === 'pass');
  const isOk = fails.length === 0 && warns.length === 0;
  const activeAudit = editMode ? draft : audit;
  const ai = activeAudit.ai || {};
  const ext = ai.extracted || {};
  const recs = ai.recommendations || [];
  const category = ai.category || 'navigation';
  const isOutOfScope = category && category !== 'navigation';

  const CATEGORY_META = {
    functional: { label: 'ФУНКЦИОНАЛЬНЫЙ ЗНАК', hex: '#F59E0B', desc: 'Знак по BS ISO 7010:2011 (предупреждение / запрет / указание / эвакуация) — вне области ЕНС' },
    service: { label: 'СЛУЖЕБНЫЙ ЗНАК', hex: '#64748B', desc: 'Ведомственный / служебный указатель — вне области Руководства ЕНС' },
    other: { label: 'НЕ УКАЗАТЕЛЬ РЖД', hex: '#9CA3AF', desc: 'На фото не обнаружен указатель системы РЖД' }
  };

  const statusText = isOutOfScope ? 'ВНЕ ОБЛАСТИ ЕНС' : isOk ? 'СООТВЕТСТВУЕТ' : fails.length > 0 ? 'НАРУШЕНИЯ' : 'ЗАМЕЧАНИЯ';
  const statusHex = isOutOfScope ? (CATEGORY_META[category]?.hex || '#64748B') : isOk ? '#059669' : fails.length > 0 ? C.red : '#d97706';

  const updateRuleStatus = (key, newStatus) => {
    setDraft(d => ({ ...d, ai: { ...d.ai, rules: { ...d.ai.rules, [key]: { ...d.ai.rules[key], status: newStatus } } } }));
  };
  const updateRuleText = (key, newText) => {
    setDraft(d => ({ ...d, ai: { ...d.ai, rules: { ...d.ai.rules, [key]: { ...d.ai.rules[key], reasoning: newText } } } }));
  };
  const updateRec = (i, val) => {
    setDraft(d => { const r = [...(d.ai.recommendations || [])]; r[i] = val; return { ...d, ai: { ...d.ai, recommendations: r } }; });
  };
  const addRec = () => setDraft(d => ({ ...d, ai: { ...d.ai, recommendations: [...(d.ai.recommendations || []), ''] } }));
  const removeRec = (i) => setDraft(d => { const r = [...(d.ai.recommendations || [])]; r.splice(i, 1); return { ...d, ai: { ...d.ai, recommendations: r } }; });
  const updateSummary = (v) => setDraft(d => ({ ...d, ai: { ...d.ai, summary: v } }));

  const saveDraft = async () => {
    await saveAudit(draft);
    onUpdate(draft);
    setEditMode(false);
  };
  const cancelDraft = () => { setDraft(JSON.parse(JSON.stringify(audit))); setEditMode(false); };

  const checkBg = (status) => status === 'pass' ? { bg: '#ECFDF5', border: '#10B981' } : status === 'warn' ? { bg: '#FFFBEB', border: '#F59E0B' } : { bg: '#FEF2F2', border: C.red };
  const checkCircle = (status) => status === 'pass' ? '#10B981' : status === 'warn' ? '#F59E0B' : C.red;

  return (
    <div className="min-h-screen bg-stone-100 pb-28">
      <Header title="Результат проверки" onBack={onHome}
        right={!editMode ? (
          <button onClick={() => setEditMode(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md flex items-center gap-1.5" style={{ backgroundColor: C.grey }}>
            <Pencil size={12} /> ПРАВИТЬ
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button onClick={cancelDraft} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-stone-700 bg-stone-200">Отмена</button>
            <button onClick={saveDraft} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md flex items-center gap-1.5" style={{ backgroundColor: '#059669' }}><Save size={12} /> СОХРАНИТЬ</button>
          </div>
        )}
      />
      <div className="max-w-xl mx-auto px-5 py-5">

        {editMode && <div className="rounded-xl p-3 mb-4 text-sm shadow-sm flex gap-2" style={{ backgroundColor: '#EFF6FF', border: '2px solid #93C5FD', color: '#1E3A8A' }}>
          <Pencil size={16} className="shrink-0 mt-0.5" />
          <div>Режим правки эксперта. Клик на иконку статуса проверки — меняет pass/warn/fail. Тексты и рекомендации редактируются.</div>
        </div>}

        {/* Статус-баннер */}
        <div className="rounded-2xl p-6 mb-5 text-white relative overflow-hidden shadow-xl" style={{ backgroundColor: statusHex }}>
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="text-xs font-mono tracking-widest opacity-90 mb-2">СТАТУС УКАЗАТЕЛЯ</div>
            <div className="text-3xl font-black mb-3" style={{ fontFamily: 'Archivo, sans-serif' }}>{statusText}</div>
            <div className="flex gap-4 text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5"><Check size={14} /> {passes.length}</span>
              {warns.length > 0 && <span className="inline-flex items-center gap-1.5"><AlertTriangle size={14} /> {warns.length}</span>}
              {fails.length > 0 && <span className="inline-flex items-center gap-1.5"><X size={14} /> {fails.length}</span>}
            </div>
            {editMode ? (
              <textarea value={ai.summary || ''} onChange={e => updateSummary(e.target.value)} placeholder="Краткое резюме..."
                className="w-full mt-4 pt-2 px-2 bg-white/10 border border-white/30 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/60" rows={2} />
            ) : ai.summary && <div className="mt-4 pt-4 border-t border-white/20 text-sm leading-relaxed">{ai.summary}</div>}
          </div>
        </div>

        {isOutOfScope && CATEGORY_META[category] && (
          <div className="rounded-2xl p-4 mb-4 flex gap-3 shadow-sm" style={{ backgroundColor: CATEGORY_META[category].hex + '15', border: `2px solid ${CATEGORY_META[category].hex}60` }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow" style={{ backgroundColor: CATEGORY_META[category].hex }}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm mb-0.5" style={{ fontFamily: 'Archivo, sans-serif', color: CATEGORY_META[category].hex }}>{CATEGORY_META[category].label}</div>
              <div className="text-xs text-stone-700 leading-relaxed">{CATEGORY_META[category].desc}</div>
              {ai.category_note && <div className="text-xs text-stone-600 mt-1.5 italic">«{ai.category_note}»</div>}
              <div className="text-xs text-stone-500 mt-2 font-mono">Правила ЕНС к этому указателю неприменимы. См. стр. 13 Руководства — функциональная палитра BS ISO 7010:2011.</div>
            </div>
          </div>
        )}

        {audit.photo && <div className="mb-4 rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm"><img src={audit.photo} alt="Указатель" className="w-full h-48 object-cover" /></div>}

        {/* AI распознал */}
        <div className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-stone-200">
          <button onClick={() => setShowAI(!showAI)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-stone-50">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-md" style={{ background: 'linear-gradient(135deg, #8b5cf6, #4f46e5)' }}><Eye size={18} /></div>
            <div className="flex-1">
              <div className="font-bold text-sm text-stone-900 flex items-center gap-2">AI распознал <Sparkles size={12} style={{ color: '#8b5cf6' }} /></div>
              <div className="text-xs text-stone-500">Что нашла система на фото</div>
            </div>
            <ChevronRight size={18} className={`text-stone-400 transition-transform ${showAI ? 'rotate-90' : ''}`} />
          </button>
          {showAI && (
            <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-2 text-xs">
              {ext.what_i_see && <div className="rounded-lg p-3 italic mb-3" style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', color: '#44403c' }}>«{ext.what_i_see}»</div>}
              <Row k="Русская легенда" v={ext.legend_ru || '—'} />
              <Row k="English legend" v={ext.legend_en || '—'} />
              <Row k="Тип указателя" v={ext.sign_type ? `${ext.sign_type} (${ext.sign_type === 'A' ? 'объект' : ext.sign_type === 'B' ? 'направление' : 'информирование'})` : '—'} />
              <Row k="Серое поле" v={ext.has_gray_field === true ? 'Есть' : ext.has_gray_field === false ? 'Нет' : '—'} />
              <Row k="Красное поле" v={ext.has_red_field === true ? 'Есть' : ext.has_red_field === false ? 'Нет' : '—'} />
              <Row k="Стрелка" v={ext.has_arrow === true ? 'Есть' : ext.has_arrow === false ? 'Нет' : '—'} />
              <Row k="Пиктограммы" v={ext.has_pictogram === true ? 'Есть' : ext.has_pictogram === false ? 'Нет' : '—'} />
              <Row k="Дистанция" v={DISTANCES.find(d => d.id === audit.distance)?.label || '—'} />
            </div>
          )}
        </div>

        {/* Рекомендации (редактируемые) */}
        {(recs.length > 0 || editMode) && (
          <div className="rounded-2xl p-5 mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #FFFBEB, #FFF7ED)', border: '2px solid #FCD34D' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow" style={{ backgroundColor: '#F59E0B' }}><Lightbulb size={16} className="text-white" /></div>
              <h3 className="font-bold text-sm" style={{ fontFamily: 'Archivo, sans-serif', color: '#78350F' }}>РЕКОМЕНДАЦИИ</h3>
            </div>
            <ol className="space-y-2 text-sm text-stone-800">
              {recs.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="font-black shrink-0 text-base leading-snug" style={{ color: '#D97706' }}>{i + 1}.</span>
                  {editMode ? (
                    <div className="flex-1 flex gap-2">
                      <textarea value={r} onChange={e => updateRec(i, e.target.value)} className="flex-1 text-sm p-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-amber-500" rows={2} />
                      <button onClick={() => removeRec(i)} className="w-8 h-8 shrink-0 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><Trash2 size={14} /></button>
                    </div>
                  ) : <span>{r}</span>}
                </li>
              ))}
            </ol>
            {editMode && <button onClick={addRec} className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-amber-400 text-amber-800 hover:bg-amber-100 flex items-center gap-1"><Plus size={12} /> Добавить рекомендацию</button>}
          </div>
        )}

        {/* Детальная проверка */}
        <div className="text-xs font-mono text-stone-600 tracking-widest mb-2 mt-2 flex items-center gap-2">
          <FileCheck size={12} /> ДЕТАЛЬНАЯ ПРОВЕРКА · {checks.length} ПУНКТОВ
        </div>
        <div className="mb-2 bg-white rounded-xl p-3 shadow-sm border border-stone-200">
          <div className="text-xs text-stone-500 mb-1.5">Методология · 5 параметров аудита</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PARAMETERS).map(([num, p]) => (
              <div key={num} className="text-xs font-medium px-2 py-0.5 rounded border inline-flex items-center gap-1"
                style={{ color: p.color, backgroundColor: p.bg, borderColor: p.color + '40' }}>
                <span className="font-bold">{p.label}</span>
                <span className="opacity-80">{p.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {checks.map((c) => {
            const bg = checkBg(c.status);
            return (
              <div key={c.key} className="rounded-xl p-4 shadow-sm" style={{ backgroundColor: bg.bg, borderLeft: `4px solid ${bg.border}` }}>
                <div className="flex items-start gap-3">
                  {editMode ? (
                    <div className="flex flex-col gap-1 shrink-0">
                      {['pass', 'warn', 'fail'].map(s => (
                        <button key={s} onClick={() => updateRuleStatus(c.key, s)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                          style={{ backgroundColor: c.status === s ? checkCircle(s) : 'rgba(255,255,255,0.5)', border: c.status === s ? 'none' : `1px solid ${checkCircle(s)}`, opacity: c.status === s ? 1 : 0.5 }}>
                          {s === 'pass' ? <Check size={14} className={c.status === s ? 'text-white' : ''} style={{ color: c.status === s ? 'white' : '#10B981' }} />
                            : s === 'warn' ? <AlertTriangle size={14} style={{ color: c.status === s ? 'white' : '#F59E0B' }} />
                              : <X size={14} style={{ color: c.status === s ? 'white' : C.red }} />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow" style={{ backgroundColor: checkCircle(c.status) }}>
                      {c.status === 'pass' ? <Check size={15} className="text-white" /> : c.status === 'warn' ? <AlertTriangle size={15} className="text-white" /> : <X size={15} className="text-white" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <div className="font-bold text-sm text-stone-900">{c.rule}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.param && PARAMETERS[c.param] && (
                          <div className="text-xs font-bold px-2 py-0.5 rounded border" title={PARAMETERS[c.param].title}
                            style={{ color: PARAMETERS[c.param].color, backgroundColor: PARAMETERS[c.param].bg, borderColor: PARAMETERS[c.param].color + '40' }}>
                            {PARAMETERS[c.param].label}
                          </div>
                        )}
                        <div className="text-xs font-mono text-stone-600 px-2 py-0.5 rounded border border-stone-200" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>СТР. {c.page}</div>
                      </div>
                    </div>
                    {editMode ? (
                      <textarea value={c.detail} onChange={e => updateRuleText(c.key, e.target.value)} className="w-full text-xs p-2 border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-stone-500" rows={3} />
                    ) : <div className="text-xs text-stone-700 leading-relaxed">{c.detail}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Личный комментарий инспектора */}
        <div className="mt-5 bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow" style={{ backgroundColor: C.grey }}>
              <MessageSquare size={16} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-stone-900" style={{ fontFamily: 'Archivo, sans-serif' }}>КОММЕНТАРИЙ ИНСПЕКТОРА</h3>
              <div className="text-xs text-stone-500">Личная заметка к проверке</div>
            </div>
            {commentSaved && (
              <span className="text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-full" style={{ color: '#047857', backgroundColor: '#D1FAE5' }}>
                <Check size={12} /> сохранено
              </span>
            )}
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={saveComment}
            placeholder="Заметки, контекст, договорённости… Например: «Указатель установлен в 2019, замечание из прошлого аудита не устранено — передано руководству смены»"
            className="w-full text-sm p-3 border-2 border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:border-stone-500 focus:bg-white resize-y leading-relaxed"
            rows={4}
          />
          <div className="text-xs text-stone-400 mt-1.5 font-mono">Автосохранение при клике вне поля</div>
        </div>
      </div>

      {!editMode && (
        <BottomBar>
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={onHome} variant="light" icon={Home}>На главную</Btn>
            <Btn onClick={onNew} variant="danger" icon={RotateCcw}>Новая</Btn>
          </div>
        </BottomBar>
      )}
    </div>
  );
}
const Row = ({ k, v }) => (<div className="flex gap-3"><div className="text-stone-500 min-w-[120px]">{k}</div><div className="text-stone-900 font-semibold flex-1 break-words">{v}</div></div>);

// ─────────────────────────────────────────────────────────
// ЖУРНАЛ
// ─────────────────────────────────────────────────────────
function ScreenJournal({ onBack, audits, onOpen, onDelete, onExport }) {
  return (
    <div className="min-h-screen bg-stone-100 pb-28">
      <Header title="Журнал проверок" subtitle={`${audits.length} записей`} onBack={onBack} />
      <div className="max-w-xl mx-auto px-5 py-5">
        {audits.length === 0 ? (
          <div className="text-center py-16 text-stone-500"><ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" /><div className="text-sm">Пока нет проверок</div></div>
        ) : (
          <div className="space-y-3">
            {audits.map(a => {
              const checks = getChecks(a);
              const fails = checks.filter(c => c.status === 'fail').length;
              const warns = checks.filter(c => c.status === 'warn').length;
              const isOk = fails === 0 && warns === 0;
              const cat = a.ai?.category || 'navigation';
              const outOfScope = cat !== 'navigation';
              const badgeStyle = outOfScope
                ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                : isOk ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                : fails > 0 ? { backgroundColor: '#FEE2E2', color: C.red }
                : { backgroundColor: '#FEF3C7', color: '#92400E' };
              const badgeText = outOfScope ? 'вне ЕНС' : isOk ? 'OK' : fails > 0 ? `${fails} наруш.` : `${warns} замеч.`;
              return (
                <div key={a.id} className="bg-white rounded-2xl p-4 flex gap-3 shadow-sm border border-stone-200">
                  {a.photo ? <img src={a.photo} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" /> : <div className="w-16 h-16 rounded-lg bg-stone-200 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={badgeStyle}>{badgeText}</span>
                      <span className="text-xs font-mono text-stone-500">{a.ai?.extracted?.sign_type || '?'}</span>
                      {a.personalComment?.trim() && <MessageSquare size={12} className="text-stone-400" />}
                    </div>
                    <div className="font-semibold text-sm text-stone-900 truncate">{a.ai?.extracted?.legend_ru || '(легенда не распознана)'}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{DISTANCES.find(d => d.id === a.distance)?.label} · {new Date(a.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => onOpen(a)} className="w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-sm" style={{ backgroundColor: C.black }}><ChevronRight size={16} /></button>
                    <button onClick={() => onDelete(a.id)} className="w-8 h-8 rounded-lg bg-stone-100 text-stone-500 hover:bg-red-50 flex items-center justify-center"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {audits.length > 0 && <BottomBar><Btn onClick={onExport} variant="danger" icon={Download} className="w-full" style={{ paddingTop: 16, paddingBottom: 16 }}>ЭКСПОРТИРОВАТЬ ОТЧЁТ</Btn></BottomBar>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.grey }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return <AuditApp key={session.user.id} onSignOut={() => supabase.auth.signOut()} />;
}

function AuditApp({ onSignOut }) {
  const [screen, setScreen] = useState('home');
  const [audits, setAudits] = useState([]);
  const [currentAudit, setCurrentAudit] = useState(null);

  useEffect(() => { (async () => setAudits(await loadAudits()))(); }, []);

  const stats = {
    total: audits.length,
    ok: audits.filter(a => {
      const cat = a.ai?.category || 'navigation';
      if (cat !== 'navigation') return false;
      const c = getChecks(a);
      return c.every(x => x.status === 'pass');
    }).length,
    fail: audits.filter(a => {
      const cat = a.ai?.category || 'navigation';
      if (cat !== 'navigation') return false;
      return getChecks(a).some(x => x.status === 'fail');
    }).length
  };

  const finishAnalyze = async (audit) => { setAudits(await loadAudits()); setCurrentAudit(audit); setScreen('result'); };
  const handleDelete = async (id) => { await deleteAudit(id); setAudits(await loadAudits()); };
  const handleUpdate = async (updatedAudit) => { setCurrentAudit(updatedAudit); setAudits(await loadAudits()); };

  const handleExport = () => {
    const lines = ['═══════════════════════════════════════════════', 'ОТЧЁТ ПО АУДИТУ НАВИГАЦИОННЫХ УКАЗАТЕЛЕЙ', 'Единая навигационная система ОАО «РЖД»', `Дата формирования: ${new Date().toLocaleString('ru-RU')}`, '═══════════════════════════════════════════════', '', `Всего проверок: ${audits.length}`, `Соответствуют требованиям: ${stats.ok}`, `С нарушениями: ${stats.fail}`, '', '─── ДЕТАЛИЗАЦИЯ ───', ''];
    audits.forEach((a, i) => {
      const checks = getChecks(a);
      const fails = checks.filter(c => c.status === 'fail');
      const warns = checks.filter(c => c.status === 'warn');
      const cat = a.ai?.category || 'navigation';
      const outOfScope = cat !== 'navigation';
      const catLabel = cat === 'functional' ? 'функциональный знак (ISO 7010)' : cat === 'service' ? 'служебный знак' : cat === 'other' ? 'не РЖД' : 'пассажирская навигация';
      lines.push(`[${i + 1}] ${a.ai?.extracted?.legend_ru || '(без легенды)'}`);
      lines.push(`    Тип: ${a.ai?.extracted?.sign_type || '?'} | Категория: ${catLabel} | Дистанция: ${DISTANCES.find(d => d.id === a.distance)?.label || '—'}`);
      lines.push(`    Дата: ${new Date(a.createdAt).toLocaleString('ru-RU')}`);
      if (a.ai?.summary) lines.push(`    Резюме: ${a.ai.summary}`);
      if (outOfScope) {
        lines.push(`    ℹ  Вне области ЕНС — правила Руководства к этому знаку неприменимы`);
        if (a.ai?.category_note) lines.push(`       Пояснение: ${a.ai.category_note}`);
      } else if (!fails.length && !warns.length) {
        lines.push('    ✓ Соответствует требованиям Руководства');
      }
      fails.forEach(c => lines.push(`    ✗ [${c.rule}${c.param ? ' · ' + PARAMETERS[c.param].label : ''}, стр. ${c.page}] ${c.detail}`));
      warns.forEach(c => lines.push(`    ⚠ [${c.rule}${c.param ? ' · ' + PARAMETERS[c.param].label : ''}, стр. ${c.page}] ${c.detail}`));
      if (a.ai?.recommendations?.length && !outOfScope) { lines.push('    Рекомендации:'); a.ai.recommendations.forEach((r, j) => lines.push(`      ${j + 1}. ${r}`)); }
      if (a.personalComment?.trim()) {
        lines.push('    Комментарий инспектора:');
        a.personalComment.split('\n').forEach(l => lines.push(`      ${l}`));
      }
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `rzd-audit-${Date.now()}.txt`;
    link.click(); URL.revokeObjectURL(url);
  };

  if (screen === 'home') return <ScreenHome onNew={() => setScreen('analyze')} onJournal={() => setScreen('journal')} auditCount={audits.length} stats={stats} onSignOut={onSignOut} />;
  if (screen === 'analyze') return <ScreenAnalyze onBack={() => setScreen('home')} onDone={finishAnalyze} />;
  if (screen === 'result') return <ScreenResult audit={currentAudit} onHome={() => setScreen('home')} onNew={() => setScreen('analyze')} onUpdate={handleUpdate} />;
  if (screen === 'journal') return <ScreenJournal onBack={() => setScreen('home')} audits={audits} onOpen={a => { setCurrentAudit(a); setScreen('result'); }} onDelete={handleDelete} onExport={handleExport} />;
  return null;
}
