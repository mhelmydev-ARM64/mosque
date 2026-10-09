import type { TaskPriority, TaskStatus } from './models';

export const TASK_STATUSES: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'جديدة',
  in_progress: 'قيد التنفيذ',
  done: 'منجزة',
  cancelled: 'ملغاة',
};

export const TASK_STATUS_TONES: Record<TaskStatus, string> = {
  open: 'badge--info',
  in_progress: 'badge--warn',
  done: 'badge--ok',
  cancelled: '',
};

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high'];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عاجلة',
};

export function taskStatusBadgeClass(status: TaskStatus): string {
  return `badge ${TASK_STATUS_TONES[status] ?? ''}`.trim();
}

export function isOverdue(status: TaskStatus, dueDate: { toDate(): Date } | null | undefined): boolean {
  if (!dueDate || status === 'done' || status === 'cancelled') return false;
  return dueDate.toDate().getTime() < Date.now();
}
