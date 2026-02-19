import Tesseract from 'tesseract.js'
import fetch from 'node-fetch'
import fs from 'fs'

// Recognize OCR text from image URL and return plain text
export async function ocrFromUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch image')
  const buffer = await res.arrayBuffer()
  const { data: { text } } = await Tesseract.recognize(Buffer.from(buffer), 'eng')
  return text
}

// simple CLI when run directly
if (process.argv[2]) {
  const url = process.argv[2]
  ocrFromUrl(url).then((text) => {
    console.log('OCR result:\n')
    console.log(text)
  }).catch((err) => console.error(err))
}
