import { supabase } from './supabase';

export async function listStations() {
  const { data, error } = await supabase
    .from('stations')
    .select('id, name, code, city, latitude, longitude')
    .order('name');
  if (error) {
    console.error('listStations error', error);
    return [];
  }
  return data ?? [];
}

export async function createStation(input) {
  const { error } = await supabase.from('stations').insert(input);
  if (error) throw error;
}

export async function updateStation(id, patch) {
  const { error } = await supabase.from('stations').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteStation(id) {
  const { error } = await supabase.from('stations').delete().eq('id', id);
  if (error) throw error;
}
