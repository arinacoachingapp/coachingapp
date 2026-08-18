import { handleVercelAdmin } from '../../server/adminRouter.js'

export const config = { maxDuration: 30 }

/** Fallback for /api/admin/prompts/:key when nested catch-alls are not routed. */
export default async function handler(req, res) {
  return handleVercelAdmin(req, res, '/api/admin/prompts')
}
