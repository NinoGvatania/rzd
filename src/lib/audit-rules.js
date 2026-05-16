export const DISTANCES = [
  { id: '<10',  label: 'до 10 м',   minX: 36 },
  { id: '10-15', label: '10–15 м',  minX: 48 },
  { id: '15-20', label: '15–20 м',  minX: 48 },
  { id: '>20',  label: 'более 20 м', minX: 64 },
];

export const PARAMETERS = {
  1: { label: 'П1', title: 'Визуальные стандарты',          color: '#6366F1', bg: '#EEF2FF' },
  2: { label: 'П2', title: 'Пространственная логика',       color: '#0891B2', bg: '#ECFEFF' },
  3: { label: 'П3', title: 'Семантическая достаточность',   color: '#8B5CF6', bg: '#F5F3FF' },
  4: { label: 'П4', title: 'Доступность',                   color: '#059669', bg: '#ECFDF5' },
  5: { label: 'П5', title: 'Актуальность',                  color: '#EA580C', bg: '#FFF7ED' },
};

export const RULE_META = {
  bilingual:           { title: 'Двуязычность',                page: 14, param: 1 },
  color_palette:       { title: 'Цветовая палитра',            page: 13, param: 1 },
  fields_layout:       { title: 'Структура и пропорции полей', page: 17, param: 1 },
  info_priority:       { title: 'Приоритет информации',        page: 7,  param: 3 },
  sign_typology:       { title: 'Типология указателя',         page: 9,  param: 3 },
  typography:          { title: 'Гарнитура FSRailway Book',    page: 14, param: 1 },
  font_size_adequacy:  { title: 'Размер шрифта для дистанции', page: 8,  param: 2 },
};

export const ZONES = [
  { id: 'entrance',  label: 'Вход в вокзал',     hint: 'Зона входной группы' },
  { id: 'tickets',   label: 'Зона касс',          hint: 'Кассовый зал и подходы' },
  { id: 'flow',      label: 'Пассажиропоток',     hint: 'Главные проходы и переходы' },
  { id: 'platforms', label: 'Платформы',          hint: 'Пути и платформенные зоны' },
];
export const ZONE_LABELS = Object.fromEntries(ZONES.map((z) => [z.id, z.label]));

export function getChecks(audit) {
  const rules = audit.ai?.rules || {};
  return Object.entries(RULE_META).map(([key, meta]) => {
    const r = rules[key];
    return {
      key,
      status: r?.status || 'pass',
      rule: meta.title,
      detail: r?.reasoning || 'Нет данных',
      page: meta.page,
      param: meta.param,
    };
  });
}

export function isOutOfScope(audit) {
  const cat = audit.ai?.category || 'navigation';
  return cat !== 'navigation';
}
