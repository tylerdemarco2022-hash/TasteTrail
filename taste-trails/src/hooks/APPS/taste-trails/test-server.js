import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const port = 8787
app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`)
  console.log('Server is stable and waiting for requests...')
})

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason)
})
