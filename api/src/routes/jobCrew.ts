import { Router } from 'express';
import { prisma } from '../lib/prisma';

// Who is assigned to a job, the crew's posted updates, and their hours on it.
// Open to every admin user (no pay rates here; pay stays OWNER-only).
export const jobCrewRouter = Router();

jobCrewRouter.get('/:jobId', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const [job, assignments, employees, updates, hours] = await Promise.all([
      prisma.job.findUnique({ where: { id: jobId }, select: { id: true, crew_notes: true } }),
      prisma.jobAssignment.findMany({
        where: { job_id: jobId },
        include: { employee: { select: { id: true, first_name: true, last_name: true, position: true, app_access: true } } },
      }),
      prisma.employee.findMany({
        where: { deleted_at: null, status: 'ACTIVE' },
        select: { id: true, first_name: true, last_name: true, position: true, app_access: true },
        orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
      }),
      prisma.jobCrewUpdate.findMany({
        where: { job_id: jobId },
        orderBy: { created_at: 'desc' },
        take: 50,
        include: { employee: { select: { id: true, first_name: true, last_name: true } } },
      }),
      prisma.timeEntry.groupBy({
        by: ['employee_id', 'status'],
        where: { job_id: jobId, status: { in: ['APPROVED', 'PENDING'] } },
        _sum: { hours: true },
      }),
    ]);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const hoursByEmployee: Record<string, { approved: number; pending: number }> = {};
    for (const h of hours) {
      const cur = (hoursByEmployee[h.employee_id] ||= { approved: 0, pending: 0 });
      cur[h.status === 'APPROVED' ? 'approved' : 'pending'] += Number(h._sum.hours || 0);
    }
    res.json({
      data: {
        crew_notes: job.crew_notes,
        assigned: assignments.map((a) => a.employee),
        employees,
        updates,
        hours: hoursByEmployee,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load crew' });
  }
});

// Replace the job's crew with exactly these employees.
jobCrewRouter.put('/:jobId', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const ids: string[] = Array.isArray(req.body.employee_ids) ? req.body.employee_ids.filter((x: unknown) => typeof x === 'string') : [];
    await prisma.$transaction([
      prisma.jobAssignment.deleteMany({ where: { job_id: jobId, employee_id: { notIn: ids } } }),
      ...ids.map((employee_id) =>
        prisma.jobAssignment.upsert({
          where: { job_id_employee_id: { job_id: jobId, employee_id } },
          create: { job_id: jobId, employee_id },
          update: {},
        }),
      ),
    ]);
    if ('crew_notes' in req.body) {
      await prisma.job.update({ where: { id: jobId }, data: { crew_notes: req.body.crew_notes || null } });
    }
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to update crew' });
  }
});

jobCrewRouter.delete('/:jobId/updates/:updateId', async (req, res) => {
  try {
    await prisma.jobCrewUpdate.deleteMany({ where: { id: req.params.updateId, job_id: req.params.jobId } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete update' });
  }
});
