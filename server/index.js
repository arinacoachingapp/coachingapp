import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleGenerateRoleCard } from './generateRoleCard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const port = Number(process.env.PORT) || 4173

const app = express()
app.use(express.json({ limit: '1mb' }))

app.post('/api/career/generate-role-card', async (req, res) => {
  try {
    const result = await handleGenerateRoleCard({
      authorization: req.headers.authorization,
      sessionId: req.body?.sessionId,
      env: process.env,
    })
    res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Generate role card error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.log(`Career Companion listening on http://localhost:${port}`)
})
