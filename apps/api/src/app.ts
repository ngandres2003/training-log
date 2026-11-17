import express, { type Express } from 'express'

export function createApp(): Express {
  const app = express()

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  return app
}
