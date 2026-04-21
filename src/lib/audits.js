import { supabase } from './supabase';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function listAudits() {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('audits')
    .select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listAudits error', error);
    return [];
  }
  return (data ?? []).map((row) => row.data);
}

export async function saveAudit(audit) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('audits')
    .upsert({
      id: audit.id,
      user_id: userId,
      created_at: audit.createdAt,
      data: audit,
    });
  if (error) throw error;
}

export async function deleteAuditById(id) {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('audits')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) console.error('deleteAudit error', error);
}
