import { exec } from 'child_process'
import dotenv from 'dotenv'
dotenv.config()

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    const p = exec(cmd, { env: process.env })
    p.stdout.on('data', (d) => process.stdout.write(d))
    p.stderr.on('data', (d) => process.stderr.write(d))
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with ${code}`))
    })
  })
}

async function main() {
  console.log('Starting full pipeline: yelp-fetch -> scrape -> process')

  if (!process.env.YELP_API_KEY) console.warn('Warning: YELP_API_KEY not set in .env')
  if (!process.env.OPENAI_API_KEY) console.warn('Warning: OPENAI_API_KEY not set in .env')
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) console.warn('Warning: SUPABASE env vars not set')

  try {
    console.log('\n[1/3] Running yelp-fetch...')
    await runCmd('npm run yelp-fetch')

    console.log('\n[2/3] Running scraper to collect menu photos...')
    await runCmd('npm run scrape')

    console.log('\n[3/3] Processing restaurants (OCR -> OpenAI -> Supabase)...')
    await runCmd('npm run process')

    console.log('\nFull pipeline completed')
  } catch (e) {
    console.error('Pipeline failed:', e.message)
    process.exit(1)
  }
}

if (require.main === module) main()
