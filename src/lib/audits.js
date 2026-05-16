import { supabase } from './supabase';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// Опции: { stationId, scope: 'own' | 'station' | 'all' }
export async function listAudits(opts = {}) {
  let query = supabase
    .from('audits')
    .select('data, station_id, zone, latitude, longitude, created_at, user_id')
    .order('created_at', { ascending: false });

  if (opts.scope === 'station' && opts.stationId) {
    query = query.eq('station_id', opts.stationId);
  } else if (opts.scope === 'own') {
    const userId = await currentUserId();
    if (!userId) return [];
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('listAudits error', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row.data,
    stationId: row.station_id,
    zone: row.zone,
    location: row.latitude != null && row.longitude != null
      ? { lat: row.latitude, lng: row.longitude }
      : null,
  }));
}

export async function saveAudit(audit) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase.from('audits').upsert({
    id: audit.id,
    user_id: userId,
    created_at: audit.createdAt,
    station_id: audit.stationId ?? null,
    zone: audit.zone ?? null,
    latitude: audit.location?.lat ?? null,
    longitude: audit.location?.lng ?? null,
    data: audit,
  });
  if (error) throw error;
}

export async function deleteAuditById(id) {
  const { error } = await supabase.from('audits').delete().eq('id', id);
  if (error) console.error('deleteAudit error', error);
}
