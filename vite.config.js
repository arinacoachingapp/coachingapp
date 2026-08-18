import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleGenerateRoleCard } from './server/generateRoleCard.js'
import { handleInterviewTurn } from './server/interviewTurn.js'
import { handleSpeak } from './server/speak.js'
import { handleTranscribe } from './server/transcribe.js'
import { routeAdminRequest } from './server/adminRouter.js'
import { handleCareerSettings } from './server/careerSettings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readJsonBody(req, limitBytes = 12 * 1024 * 1024) {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > limitBytes) {
          reject(new Error('Request body too large'))
          return
        }
        chunks.push(chunk)
      }
      const body = Buffer.concat(chunks).toString('utf8')
      resolve(body ? JSON.parse(body) : {})
    } catch (error) {
      reject(error)
    }
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function careerApiPlugin(env) {
  return {
    name: 'career-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]

        if (url === '/api/career/generate-role-card') {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          try {
            const json = await readJsonBody(req)
            const result = await handleGenerateRoleCard({
              authorization: req.headers.authorization,
              sessionId: json.sessionId,
              env,
            })
            sendJson(res, result.status, result.body)
          } catch (error) {
            console.error('Generate role card error:', error)
            sendJson(res, 500, { error: error.message || 'Internal server error' })
          }
          return
        }

        if (url === '/api/career/interview-turn') {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          try {
            const json = await readJsonBody(req)
            const result = await handleInterviewTurn({
              authorization: req.headers.authorization,
              sessionId: json.sessionId,
              action: json.action,
              message: json.message,
              names: json.names,
              env,
            })
            sendJson(res, result.status, result.body)
          } catch (error) {
            console.error('Interview turn error:', error)
            sendJson(res, 500, { error: error.message || 'Internal server error' })
          }
          return
        }

        if (url === '/api/career/speak') {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          try {
            const json = await readJsonBody(req)
            const result = await handleSpeak({
              authorization: req.headers.authorization,
              text: json.text,
              voiceId: json.voiceId,
              env,
            })
            sendJson(res, result.status, result.body)
          } catch (error) {
            console.error('Speak error:', error)
            sendJson(res, 500, { error: error.message || 'Internal server error' })
          }
          return
        }

        if (url === '/api/career/transcribe') {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          try {
            const json = await readJsonBody(req)
            const result = await handleTranscribe({
              authorization: req.headers.authorization,
              audioBase64: json.audioBase64,
              format: json.format,
              language: json.language,
              env,
            })
            sendJson(res, result.status, result.body)
          } catch (error) {
            console.error('Transcribe error:', error)
            sendJson(res, 500, { error: error.message || 'Internal server error' })
          }
          return
        }

        if (url === '/api/career/settings') {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          try {
            const result = await handleCareerSettings({
              authorization: req.headers.authorization,
              env,
            })
            sendJson(res, result.status, result.body)
          } catch (error) {
            console.error('Career settings error:', error)
            sendJson(res, 500, { error: error.message || 'Internal server error' })
          }
          return
        }

        if (url?.startsWith('/api/admin')) {
          try {
            const body = ['PUT', 'POST', 'PATCH'].includes(req.method)
              ? await readJsonBody(req)
              : {}
            const result = await routeAdminRequest({
              method: req.method,
              pathname: url.split('?')[0],
              authorization: req.headers.authorization,
              body,
              env,
            })
            sendJson(res, result.status, result.body)
          } catch (error) {
            console.error('Admin API error:', error)
            sendJson(res, 500, { error: error.message || 'Internal server error' })
          }
          return
        }

        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), careerApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
