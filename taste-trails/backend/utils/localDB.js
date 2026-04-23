import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { safeJsonParse } from '../utils/safeJsonParse.js';

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolvePath(file) {
  return path.join(__dirname, '../data', file)
}

export function readJSON(file) {
  const filePath = resolvePath(file)
  if (!fs.existsSync(filePath)) return []
  let text = fs.readFileSync(filePath, 'utf-8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  text = text.trim()
  try {
    return safeJsonParse(`file:${filePath}`, text)
  } catch (err) {
    const dumpPath = `/tmp/json_file_failure_${Date.now()}.txt`
    fs.writeFileSync(dumpPath, text, { encoding: 'utf8' })
    throw err
  }
}

export function writeJSON(file, data) {
  const filePath = resolvePath(file)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}
