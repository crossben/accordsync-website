import type { Claims, FieldRead } from '@accordsync/server';
import { describe, expect, it } from 'vitest';
import {
  fieldTeam,
  multiTenant,
  personal,
  sharedLists,
  supervised,
} from '../../../examples/scopes/patterns';

type Pattern = {
  scopes: (r: { id: string; fields: Record<string, FieldRead> }) => string[];
  access: (c: Claims) => { read: readonly string[]; write: readonly string[] };
};
const overlaps = (a: readonly string[], b: readonly string[]) => a.some((k) => b.includes(k));
/** What the server decides for a user and a record, with these scope rules. */
const can = (p: Pattern, claims: Claims, fields: Record<string, FieldRead>) => {
  const keys = p.scopes({ id: 'r:1', fields });
  const { read, write } = p.access(claims);
  return { read: overlaps(keys, read), write: overlaps(keys, write) };
};
const user = (sub: string, extra: Record<string, unknown> = {}): Claims => ({ sub, ...extra });

describe('scope patterns (docs/scopes.md)', () => {
  it('personal: only the owner', () => {
    expect(can(personal, user('awa'), { owner: 'awa' })).toEqual({ read: true, write: true });
    expect(can(personal, user('moussa'), { owner: 'awa' })).toEqual({ read: false, write: false });
  });

  it('field team: own dossiers writable, zone dossiers readable', () => {
    const awa = user('awa', { zones: ['dakar'] });
    expect(can(fieldTeam, awa, { agent: 'awa', zone: 'dakar' })).toEqual({
      read: true,
      write: true,
    });
    expect(can(fieldTeam, awa, { agent: 'moussa', zone: 'dakar' })).toEqual({
      read: true,
      write: false,
    });
    expect(can(fieldTeam, awa, { agent: 'fatou', zone: 'thies' })).toEqual({
      read: false,
      write: false,
    });
  });

  it('supervisor: writes every dossier of their zones, agents do not', () => {
    const boss = user('khady', { zones: ['dakar'], role: 'supervisor' });
    expect(can(supervised, boss, { agent: 'moussa', zone: 'dakar' })).toEqual({
      read: true,
      write: true,
    });
    expect(can(supervised, boss, { agent: 'fatou', zone: 'thies' })).toEqual({
      read: false,
      write: false,
    });
    expect(
      can(supervised, user('awa', { zones: ['dakar'] }), { agent: 'moussa', zone: 'dakar' }).write,
    ).toBe(false);
  });

  it('multi-tenant: tenants never see each other; only admins write', () => {
    expect(can(multiTenant, user('a', { org: 'acme', role: 'admin' }), { org: 'acme' })).toEqual({
      read: true,
      write: true,
    });
    expect(can(multiTenant, user('b', { org: 'acme' }), { org: 'acme' })).toEqual({
      read: true,
      write: false,
    });
    expect(can(multiTenant, user('c', { org: 'globex', role: 'admin' }), { org: 'acme' })).toEqual({
      read: false,
      write: false,
    });
    expect(can(multiTenant, user('d'), { org: 'acme' })).toEqual({ read: false, write: false }); // no org claim
  });

  it('shared lists: members only, and membership changes move the record', () => {
    expect(can(sharedLists, user('awa'), { members: ['awa', 'moussa'] })).toEqual({
      read: true,
      write: true,
    });
    expect(can(sharedLists, user('fatou'), { members: ['awa', 'moussa'] })).toEqual({
      read: false,
      write: false,
    });
  });

  it('records without the scoping field are invisible (fail closed)', () => {
    for (const p of [personal, fieldTeam, multiTenant, sharedLists] as Pattern[]) {
      expect(can(p, user('awa', { zones: ['dakar'], org: 'acme' }), {})).toEqual({
        read: false,
        write: false,
      });
    }
  });
});
