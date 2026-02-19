import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import restaurantsRouter from './routes/restaurants.js'
import { logger } from './utils/logger.js'

const app = express()

app.use(helmet())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
)

app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.use('/restaurants', restaurantsRouter)

app.get('/', (req, res) => {
  res.json({
    service: 'menu-ingestion',
    endpoints: {
      search: { method: 'POST', path: '/restaurants/search' },
      ingest: { method: 'POST', path: '/restaurants/ingest' },
      getMenu: { method: 'GET', path: '/restaurants/:id/menu' }
    }
  })
})

const port = process.env.PORT || 8080
app.listen(port, () => logger.info(`Menu ingestion server listening on ${port}`))
