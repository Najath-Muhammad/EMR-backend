import { z } from 'zod';

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export const sessionSchema = z
  .object({
    startTime: z.string().regex(timeRegex, 'startTime must be in HH:mm 24-hour format'),
    endTime: z.string().regex(timeRegex, 'endTime must be in HH:mm 24-hour format'),
    label: z.string().max(50).optional(),
  })
  .refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
    message: 'Session endTime must be strictly after startTime',
    path: ['endTime'],
  });

export const breakSchema = z
  .object({
    startTime: z.string().regex(timeRegex, 'startTime must be in HH:mm 24-hour format'),
    endTime: z.string().regex(timeRegex, 'endTime must be in HH:mm 24-hour format'),
    label: z.string().max(50).optional(),
  })
  .refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
    message: 'Break endTime must be strictly after startTime',
    path: ['endTime'],
  });

export const workingDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    dayName: z.enum([
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ]),
    isEnabled: z.boolean().default(true),
    sessions: z.array(sessionSchema).default([]),
    breaks: z.array(breakSchema).default([]),
  })
  .superRefine((day, ctx) => {
    if (!day.isEnabled) return;

    // 1. Check for overlapping sessions
    const sortedSessions = [...day.sessions].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (let i = 0; i < sortedSessions.length - 1; i++) {
      const current = sortedSessions[i];
      const next = sortedSessions[i + 1];
      if (current && next && timeToMinutes(current.endTime) > timeToMinutes(next.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Overlapping working sessions detected on ${day.dayName}: ${current.startTime}-${current.endTime} overlaps with ${next.startTime}-${next.endTime}`,
          path: ['sessions'],
        });
      }
    }

    // 2. Check for overlapping breaks
    const sortedBreaks = [...day.breaks].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (let i = 0; i < sortedBreaks.length - 1; i++) {
      const current = sortedBreaks[i];
      const next = sortedBreaks[i + 1];
      if (current && next && timeToMinutes(current.endTime) > timeToMinutes(next.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Overlapping breaks detected on ${day.dayName}: ${current.startTime}-${current.endTime} overlaps with ${next.startTime}-${next.endTime}`,
          path: ['breaks'],
        });
      }
    }

    // 3. Ensure each break is completely within at least one working session
    for (const brk of day.breaks) {
      const breakStart = timeToMinutes(brk.startTime);
      const breakEnd = timeToMinutes(brk.endTime);

      const isInsideAnySession = day.sessions.some((session) => {
        const sessionStart = timeToMinutes(session.startTime);
        const sessionEnd = timeToMinutes(session.endTime);
        return breakStart >= sessionStart && breakEnd <= sessionEnd;
      });

      if (!isInsideAnySession) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Break ${brk.startTime}-${brk.endTime} on ${day.dayName} must fall completely within a scheduled working session`,
          path: ['breaks'],
        });
      }
    }
  });

export const saveScheduleSchema = z.object({
  slotDuration: z
    .number()
    .int()
    .min(5, 'Slot duration must be at least 5 minutes')
    .max(120, 'Slot duration cannot exceed 120 minutes')
    .default(15),
  workingDays: z
    .array(workingDaySchema)
    .min(1, 'Schedule must include at least one day configuration'),
  isActive: z.boolean().default(true),
});

export type SessionInput = z.infer<typeof sessionSchema>;
export type BreakInput = z.infer<typeof breakSchema>;
export type WorkingDayInput = z.infer<typeof workingDaySchema>;
export type SaveScheduleInput = z.infer<typeof saveScheduleSchema>;
