import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleGenerateRoleCard } from './generateRoleCard.js'
import { handleInterviewTurn } from './interviewTurn.js'
import { handleSpeak } from './speak.js'
import { handleTranscribe } from './transcribe.js'
import {
  handleAdminAdmins,
  handleAdminMe,
  handleAdminPromptVersion,
  handleAdminPrompts,
  handleAdminSettings,
} from './adminHandlers.js'
import { handleCareerSettings } from './careerSettings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const port = Number(process.env.PORT) || 4173

const app = express()
app.use(express.json({ limit: '12mb' }))

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

app.post('/api/career/interview-turn', async (req, res) => {
  try {
    const result = await handleInterviewTurn({
      authorization: req.headers.authorization,
      sessionId: req.body?.sessionId,
      action: req.body?.action,
      message: req.body?.message,
      names: req.body?.names,
      env: process.env,
    })
    res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Interview turn error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

app.post('/api/career/speak', async (req, res) => {
  try {
    const result = await handleSpeak({
      authorization: req.headers.authorization,
      text: req.body?.text,
      voiceId: req.body?.voiceId,
      env: process.env,
    })
    if (result.binary) {
      res.status(result.status)
      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Cache-Control', 'no-store')
      return res.end(result.buffer)
    }
    res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Speak error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

app.post('/api/career/transcribe', async (req, res) => {
  try {
    const result = await handleTranscribe({
      authorization: req.headers.authorization,
      audioBase64: req.body?.audioBase64,
      format: req.body?.format,
      language: req.body?.language,
      env: process.env,
    })
    res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Transcribe error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

app.get('/api/admin/me', async (req, res) => {
  const result = await handleAdminMe({
    authorization: req.headers.authorization,
    env: process.env,
  })
  res.status(result.status).json(result.body)
})

app.get('/api/admin/settings', async (req, res) => {
  const result = await handleAdminSettings({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'GET',
  })
  res.status(result.status).json(result.body)
})

app.put('/api/admin/settings', async (req, res) => {
  const result = await handleAdminSettings({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'PUT',
    body: req.body,
  })
  res.status(result.status).json(result.body)
})

app.get('/api/career/settings', async (req, res) => {
  const result = await handleCareerSettings({
    authorization: req.headers.authorization,
    env: process.env,
  })
  res.status(result.status).json(result.body)
})

app.get('/api/admin/prompts', async (req, res) => {
  const result = await handleAdminPrompts({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'GET',
    key: null,
    body: {},
  })
  res.status(result.status).json(result.body)
})

app.get('/api/admin/prompts/:key', async (req, res) => {
  const result = await handleAdminPrompts({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'GET',
    key: req.params.key,
    body: {},
  })
  res.status(result.status).json(result.body)
})

app.put('/api/admin/prompts/:key', async (req, res) => {
  const result = await handleAdminPrompts({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'PUT',
    key: req.params.key,
    body: req.body,
  })
  res.status(result.status).json(result.body)
})

app.post('/api/admin/prompts/:key', async (req, res) => {
  const result = await handleAdminPrompts({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'POST',
    key: req.params.key,
    body: req.body,
  })
  res.status(result.status).json(result.body)
})

app.get('/api/admin/prompts/:key/versions/:version', async (req, res) => {
  const result = await handleAdminPromptVersion({
    authorization: req.headers.authorization,
    env: process.env,
    key: req.params.key,
    version: req.params.version,
  })
  res.status(result.status).json(result.body)
})

app.get('/api/admin/admins', async (req, res) => {
  const result = await handleAdminAdmins({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'GET',
  })
  res.status(result.status).json(result.body)
})

app.post('/api/admin/admins', async (req, res) => {
  const result = await handleAdminAdmins({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'POST',
    body: req.body,
  })
  res.status(result.status).json(result.body)
})

app.delete('/api/admin/admins/:email', async (req, res) => {
  const result = await handleAdminAdmins({
    authorization: req.headers.authorization,
    env: process.env,
    method: 'DELETE',
    email: req.params.email,
  })
  res.status(result.status).json(result.body)
})

app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.log(`Career Companion listening on http://localhost:${port}`)
})
