import { describe, expect, it } from 'vitest';
import {
  effectiveCommitteePermission,
  hasGlobalPermission,
  isManagerUser,
} from '../../src/domain/permissions';
import type { AppUser, Committee, CommitteeMembership } from '../../src/domain/models';

const user = (over: Partial<AppUser> = {}): AppUser => ({
  uid: 'u1',
  name: 'مستخدم',
  phone: '963900000001',
  status: 'approved',
  role: 'member',
  globalPermissions: [],
  committeeIds: ['c1'],
  ...over,
});

const committee = (over: Partial<Committee> = {}): Committee => ({
  id: 'c1',
  name: 'لجنة',
  colorKey: 'blue',
  status: 'active',
  teamWidePermissions: [],
  ...over,
});

const membership = (over: Partial<CommitteeMembership> = {}): CommitteeMembership => ({
  uid: 'u1',
  role: 'member',
  grants: [],
  denies: [],
  status: 'active',
  ...over,
});

describe('effectiveCommitteePermission — أولوية الحسم', () => {
  it('superAdmin المقبول يملك كل الصلاحيات في أي لجنة دون عضوية', () => {
    const u = user({ role: 'superAdmin' });
    expect(effectiveCommitteePermission(u, 'c9', null, null, 'students.read')).toBe(true);
    expect(effectiveCommitteePermission(u, 'c1', committee(), membership(), 'finance.post')).toBe(true);
  });

  it('superAdmin غير المقبول (معلق) لا يملك شيئًا', () => {
    const u = user({ role: 'superAdmin', status: 'suspended' });
    expect(effectiveCommitteePermission(u, 'c1', committee(), membership(), 'students.read')).toBe(false);
  });

  it('منحة اللجنة teamWide تكفي العضو', () => {
    const u = user();
    const c = committee({ teamWidePermissions: ['students.read'] });
    expect(effectiveCommitteePermission(u, 'c1', c, membership(), 'students.read')).toBe(true);
    expect(effectiveCommitteePermission(u, 'c1', c, membership(), 'students.create')).toBe(false);
  });

  it('المنح الفردي يسبق غياب منحة اللجنة', () => {
    const u = user();
    const m = membership({ grants: ['students.create'] });
    expect(effectiveCommitteePermission(u, 'c1', committee(), m, 'students.create')).toBe(true);
  });

  it('المنع الفردي يغلب منحة اللجنة والمنح الفردي', () => {
    const u = user();
    const c = committee({ teamWidePermissions: ['students.read'] });
    const m = membership({ grants: ['students.read'], denies: ['students.read'] });
    expect(effectiveCommitteePermission(u, 'c1', c, m, 'students.read')).toBe(false);
  });

  it('من دون عضوية أو انتماء في الملف لا صلاحية', () => {
    const u = user({ committeeIds: [] });
    expect(effectiveCommitteePermission(u, 'c1', committee(), membership(), 'students.read')).toBe(false);
    const u2 = user({ committeeIds: ['c1'] });
    expect(effectiveCommitteePermission(u2, 'c1', committee(), null, 'students.read')).toBe(false);
  });

  it('عضوية غير نشطة لا تعطي شيئًا', () => {
    const u = user();
    const c = committee({ teamWidePermissions: ['students.read'] });
    const m = membership({ status: 'active' as const });
    expect(effectiveCommitteePermission(u, 'c1', c, m, 'students.read')).toBe(true);
  });

  it('مستخدم غير موجود لا يملك شيئًا', () => {
    expect(effectiveCommitteePermission(null, 'c1', committee(), membership(), 'students.read')).toBe(false);
  });
});

describe('hasGlobalPermission', () => {
  it('superAdmin يملك الكل', () => {
    expect(hasGlobalPermission(user({ role: 'superAdmin' }), 'users.review')).toBe(true);
  });

  it('المنحة العالمية تكفي وغيرها يُرفض', () => {
    const u = user({ globalPermissions: ['users.review'] });
    expect(hasGlobalPermission(u, 'users.review')).toBe(true);
    expect(hasGlobalPermission(u, 'committees.manage')).toBe(false);
  });

  it('غير المقبول لا يملك شيئًا حتى لو مُنح', () => {
    const u = user({ status: 'pending', globalPermissions: ['users.review'] });
    expect(hasGlobalPermission(u, 'users.review')).toBe(false);
  });
});

describe('isManagerUser', () => {
  it('يميز المديرين', () => {
    expect(isManagerUser(user({ role: 'admin' }))).toBe(true);
    expect(isManagerUser(user({ role: 'superAdmin' }))).toBe(true);
    expect(isManagerUser(user({ role: 'member' }))).toBe(false);
    expect(isManagerUser(null)).toBe(false);
  });
});
