import { supabase } from './supabase';

export async function loadProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, station_id, full_name, blocked')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('loadProfile error', error);
    return null;
  }
  return data ? { ...data, email: user.email } : null;
}

export async function createProfile({ role, stationId, fullName }) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error('Not authenticated');

  const payload = { id: user.id, role, full_name: fullName ?? null };
  if (role === 'manager') payload.station_id = stationId;

  const { error } = await supabase.from('profiles').upsert(payload);
  if (error) throw error;
}
