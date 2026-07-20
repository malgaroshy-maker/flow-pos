import type { FastifyInstance } from 'fastify';
import { getLicenseInfo, activateLicense } from '../lib/license.js';

export async function licenseRoutes(app: FastifyInstance) {
  // GET /api/license/info — public/open so frontend can inspect license state
  app.get('/license/info', async () => {
    return getLicenseInfo();
  });

  // POST /api/license/activate — activate system license with key string
  app.post('/license/activate', async (req, reply) => {
    const { licenseKey } = (req.body as { licenseKey?: string }) || {};

    if (!licenseKey || typeof licenseKey !== 'string') {
      return reply.code(400).send({
        success: false,
        error: 'يرجى إدخال نص مفتاح الترخيص المطلوب تفعيله',
      });
    }

    const res = activateLicense(licenseKey);
    if (!res.success) {
      return reply.code(400).send({
        success: false,
        error: res.error || 'فشل تفعيل الترخيص',
      });
    }

    return {
      success: true,
      message: 'تم تفعيل ترخيص المنظومة بنجاح',
      data: res.info,
    };
  });
}
