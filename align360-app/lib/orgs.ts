'use client';

import { createClient } from '@/lib/supabase/client';

export type Org = { id: string; name: string; slug: string | null; created_by: string };
export type Role = 'owner' | 'admin' | 'member';
export type Member = { user_id: string; role: Role; seat_assigned: boolean; email?: string; full_name?: string | null };
export type Invite = { id: string; email: string; role: string; token: string; status: string; created_at: string };

export async function createOrg(name: string): Promise<string> {
  const s = createClient();
  const { data, error } = await s.rpc('create_organization', { p_name: name.trim() });
  if (error) throw error;
  return data as string;
}

export async function acceptInvite(token: string): Promise<string> {
  const s = createClient();
  const { data, error } = await s.rpc('accept_invitation', { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function listMyOrgs(): Promise<Org[]> {
  const s = createClient();
  const { data, error } = await s.from('organizations').select('id,name,slug,created_by').order('created_at');
  if (error) throw error;
  return (data || []) as Org[];
}

export async function getOrg(id: string): Promise<Org | null> {
  const s = createClient();
  const { data } = await s.from('organizations').select('id,name,slug,created_by').eq('id', id).maybeSingle();
  return (data as Org) || null;
}

export async function myMembership(orgId: string): Promise<{ role: Role; seat_assigned: boolean } | null> {
  const s = createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return null;
  const { data } = await s.from('organization_members').select('role,seat_assigned').eq('org_id', orgId).eq('user_id', user.id).maybeSingle();
  return (data as { role: Role; seat_assigned: boolean }) || null;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  const s = createClient();
  const { data: mems, error } = await s.from('organization_members').select('user_id,role,seat_assigned').eq('org_id', orgId);
  if (error) throw error;
  const members = (mems || []) as Member[];
  // Join emails via profiles (org admins can read member profiles per RLS).
  const ids = members.map((m) => m.user_id);
  if (ids.length) {
    const { data: profs } = await s.from('profiles').select('id,email,full_name').in('id', ids);
    const byId = new Map((profs || []).map((p: any) => [p.id, p]));
    for (const m of members) {
      const p = byId.get(m.user_id);
      if (p) { m.email = p.email; m.full_name = p.full_name; }
    }
  }
  return members.sort((a, b) => (a.role === 'owner' ? -1 : 1));
}

export async function listInvites(orgId: string): Promise<Invite[]> {
  const s = createClient();
  const { data } = await s.from('organization_invitations').select('id,email,role,token,status,created_at').eq('org_id', orgId).eq('status', 'pending').order('created_at', { ascending: false });
  return (data || []) as Invite[];
}

export async function createInvite(orgId: string, email: string, role: 'admin' | 'member'): Promise<Invite> {
  const s = createClient();
  const { data: { user } } = await s.auth.getUser();
  const { data, error } = await s.from('organization_invitations')
    .insert({ org_id: orgId, email: email.trim().toLowerCase(), role, invited_by: user?.id })
    .select('id,email,role,token,status,created_at').single();
  if (error) throw error;
  return data as Invite;
}

export async function revokeInvite(id: string): Promise<void> {
  const s = createClient();
  const { error } = await s.from('organization_invitations').update({ status: 'revoked' }).eq('id', id);
  if (error) throw error;
}

export async function setSeat(orgId: string, userId: string, seat_assigned: boolean): Promise<void> {
  const s = createClient();
  const { error } = await s.from('organization_members').update({ seat_assigned }).eq('org_id', orgId).eq('user_id', userId);
  if (error) throw error;
}

export async function setRole(orgId: string, userId: string, role: Role): Promise<void> {
  const s = createClient();
  const { error } = await s.from('organization_members').update({ role }).eq('org_id', orgId).eq('user_id', userId);
  if (error) throw error;
}

/** Purchased seats = quantity on the org's active subscription (0 until purchased). */
export async function getSeatsPurchased(orgId: string): Promise<number> {
  const s = createClient();
  const { data } = await s.from('subscriptions').select('quantity,status').eq('owner_type', 'org').eq('owner_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle();
  return data?.quantity ?? 0;
}
