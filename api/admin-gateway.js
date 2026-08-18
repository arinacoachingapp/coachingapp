import { handleVercelAdmin } from '../server/adminRouter.js'

export const config = { maxDuration: 30 }

/**
 * Single admin function for all /api/admin/* routes (via vercel.json rewrite).
 * Avoids a cold start per tab/prompt click.
 */
export default async function handler(req, res) {
  return handleVercelAdmin(req, res, '/api/admin')
}
