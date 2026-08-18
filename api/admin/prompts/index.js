import { handleVercelAdmin } from '../../../server/adminRouter.js'

export const config = { maxDuration: 30 }

/** GET /api/admin/prompts */
export default async function handler(req, res) {
  return handleVercelAdmin(req, res, '/api/admin/prompts')
}
