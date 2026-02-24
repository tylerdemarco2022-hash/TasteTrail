import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolvePath(file) {
  return path.join(__dirname, '../data', file)
}

export function readJSON(file) {
  const filePath = resolvePath(file)
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

export function writeJSON(file, data) {
  const filePath = resolvePath(file)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}
