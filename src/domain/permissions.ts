export const GLOBAL_PERMISSIONS = [
  { key: 'users.review', label: 'مراجعة الحسابات الجديدة' },
  { key: 'users.managePermissions', label: 'إدارة الأدوار والصلاحيات' },
  { key: 'committees.manage', label: 'إدارة اللجان والقنوات' },
  { key: 'templates.manage', label: 'إدارة قالب الطلاب' },
  { key: 'requests.oversight', label: 'متابعة كل الطلبات والتقارير' },
  { key: 'students.oversight', label: 'الاطلاع على كل الطلاب' },
  { key: 'backup.export', label: 'النسخ الاحتياطي والتصدير الشامل' },
] as const;

export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number]['key'];
export const GLOBAL_PERMISSION_KEYS = GLOBAL_PERMISSIONS.map((p) => p.key);

export const COMMITTEE_PERMISSIONS = [
  { key: 'students.read', label: 'عرض الطلاب', group: 'الطلاب' },
  { key: 'students.create', label: 'إضافة طالب', group: 'الطلاب' },
  { key: 'students.update', label: 'تعديل طالب', group: 'الطلاب' },
  { key: 'students.delete', label: 'أرشفة الطلاب', group: 'الطلاب' },
  { key: 'students.export', label: 'تصدير الطلاب', group: 'الطلاب' },
  { key: 'requests.send', label: 'إرسال الطلبات', group: 'الطلبات' },
  { key: 'requests.receive', label: 'استلام الطلبات', group: 'الطلبات' },
  { key: 'requests.decide', label: 'قبول/رفض الطلبات غير المالية', group: 'الطلبات' },
  { key: 'requests.execute', label: 'تنفيذ الطلبات غير المالية', group: 'الطلبات' },
  { key: 'finance.read', label: 'عرض السجل المالي', group: 'المالية' },
  { key: 'finance.post', label: 'تسجيل الحركات المالية وتنفيذها', group: 'المالية' },
  { key: 'finance.approve', label: 'الموافقة على الطلبات المالية', group: 'المالية' },
  { key: 'finance.export', label: 'تصدير السجل المالي', group: 'المالية' },
  { key: 'tasks.manage', label: 'إدارة قائمة مهام اللجنة', group: 'المتابعة' },
  { key: 'reports.write', label: 'كتابة التقرير الأسبوعي', group: 'المتابعة' },
] as const;

export type CommitteePermission = (typeof COMMITTEE_PERMISSIONS)[number]['key'];
export const COMMITTEE_PERMISSION_KEYS = COMMITTEE_PERMISSIONS.map((p) => p.key);

import type { AppUser, Committee, CommitteeMembership } from './models';

/**
 * مرآة منطق قواعد Firestore لحسم صلاحية داخل لجنة:
 * superAdmin → المنع الفردي → المنح الفردي → منحة اللجنة teamWide.
 * تستخدم في الواجهة فقط لإظهار/إخفاء الأزرار؛ السلطة النهائية في Rules.
 */
export function effectiveCommitteePermission(
  user: AppUser | null,
  committeeId: string,
  committee: Committee | null | undefined,
  membership: CommitteeMembership | null | undefined,
  perm: CommitteePermission
): boolean {
  if (!user || user.status !== 'approved') return false;
  if (user.role === 'superAdmin') return true;
  if (!user.committeeIds.includes(committeeId) || !membership) return false;
  if (membership.status !== 'active') return false;
  if (membership.denies.includes(perm)) return false;
  return membership.grants.includes(perm) || (committee?.teamWidePermissions ?? []).includes(perm);
}

export function hasGlobalPermission(user: AppUser | null, perm: string): boolean {
  if (!user || user.status !== 'approved') return false;
  if (user.role === 'superAdmin') return true;
  return user.globalPermissions.includes(perm);
}

export function isManagerUser(user: AppUser | null): boolean {
  return !!user && (user.role === 'admin' || user.role === 'superAdmin');
}
