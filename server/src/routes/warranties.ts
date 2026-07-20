import type { FastifyInstance } from 'fastify';
import { eq, desc, and, like } from 'drizzle-orm';
import {
  warranties,
  serviceTickets,
  sales,
  shifts,
  cashMovements,
  auditLogs,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export async function warrantyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // GET /api/warranties — List all active equipment warranties
  app.get('/warranties', async (req, reply) => {
    const { serial } = (req.query as any) || {};
    let query = app.db.select().from(warranties);
    if (serial) {
      return query.where(like(warranties.serialNumber, `%${serial}%`)).all();
    }
    return query.orderBy(desc(warranties.id)).all();
  });

  // GET /api/warranties/lookup/:serial — Serial number lookup for warranty status & history
  app.get('/warranties/lookup/:serial', async (req, reply) => {
    const serial = String((req.params as any).serial);
    const warranty = app.db
      .select()
      .from(warranties)
      .where(eq(warranties.serialNumber, serial))
      .get();

    const tickets = app.db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.serialNumber, serial))
      .all();

    const nowIso = new Date().toISOString();
    const isInWarranty = warranty ? warranty.endDate >= nowIso.slice(0, 10) : false;

    return {
      warranty: warranty || null,
      isInWarranty,
      tickets,
    };
  });

  // GET /api/service-tickets — List service tickets
  app.get('/service-tickets', async (req, reply) => {
    const tickets = app.db.select().from(serviceTickets).orderBy(desc(serviceTickets.id)).all();
    return tickets;
  });

  // POST /api/service-tickets — Create a new service ticket
  app.post('/service-tickets', async (req, reply) => {
    const {
      serialNumber,
      productName,
      customerId,
      customerName,
      customerPhone,
      faultDescription,
      inWarranty,
    } = (req.body as any) || {};

    if (!serialNumber || !productName || !faultDescription) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'الرقم التسلسلي، اسم الجهاز، ووصف العطل مطلوبين' });
    }

    const year = new Date().getFullYear();
    const countRes = app.db.select().from(serviceTickets).all().length;
    const ticketNumber = `SRV-${year}-${String(countRes + 1).padStart(5, '0')}`;

    // Lookup existing warranty if available
    const existingWarranty = app.db
      .select()
      .from(warranties)
      .where(eq(warranties.serialNumber, serialNumber))
      .get();

    const nowIso = new Date().toISOString();
    const isWarrantyActive = existingWarranty
      ? existingWarranty.endDate >= nowIso.slice(0, 10)
      : Boolean(inWarranty);

    const result = app.db
      .insert(serviceTickets)
      .values({
        ticketNumber,
        warrantyId: existingWarranty?.id || undefined,
        serialNumber,
        productName,
        customerId: customerId ? Number(customerId) : undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        faultDescription,
        inWarranty: isWarrantyActive,
        status: 'open',
        userId: req.user!.userId,
        createdAt: nowIso,
      })
      .run();

    const ticketId = Number(result.lastInsertRowid);
    const createdTicket = app.db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.id, ticketId))
      .get();

    return createdTicket;
  });

  // PUT /api/service-tickets/:id — Update ticket lifecycle, diagnosis, costs
  app.put('/service-tickets/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const { diagnosis, parts, laborCost, partsCost, status } = (req.body as any) || {};

    const ticket = app.db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.id, id))
      .get();

    if (!ticket) {
      return reply.code(404).send({ error: 'not_found', message: 'تذكرة الصيانة غير موجودة' });
    }

    const laborCostVal = laborCost !== undefined ? Number(laborCost) : ticket.laborCost;
    const partsCostVal = partsCost !== undefined ? Number(partsCost) : ticket.partsCost;
    const totalCost = ticket.inWarranty ? 0 : laborCostVal + partsCostVal;
    const nowIso = new Date().toISOString();

    // If changing to 'delivered' and ticket is out-of-warranty with a cost, require open shift to collect cash
    if (status === 'delivered' && ticket.status !== 'delivered' && !ticket.inWarranty && totalCost > 0) {
      const activeShift = app.db
        .select()
        .from(shifts)
        .where(eq(shifts.status, 'open'))
        .get();

      if (!activeShift) {
        return reply
          .code(400)
          .send({ error: 'no_open_shift', message: 'يرجى فتح التوكة أولاً لاستلام رسوم الصيانة نقداً' });
      }

      // Record cash movement in shift
      app.db
        .insert(cashMovements)
        .values({
          shiftId: activeShift.id,
          type: 'sale',
          amount: totalCost,
          referenceId: ticket.ticketNumber,
          userId: req.user!.userId,
          createdAt: nowIso,
        })
        .run();
    }

    app.db
      .update(serviceTickets)
      .set({
        diagnosis: diagnosis !== undefined ? diagnosis : ticket.diagnosis,
        parts: parts !== undefined ? parts : ticket.parts,
        laborCost: laborCostVal,
        partsCost: partsCostVal,
        totalCost,
        status: status || ticket.status,
        completedAt: status === 'delivered' ? nowIso : ticket.completedAt,
      })
      .where(eq(serviceTickets.id, id))
      .run();

    const updated = app.db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.id, id))
      .get();

    return updated;
  });
}
