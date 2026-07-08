import QRCode from 'qrcode'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/qr.mjs <site-url>')
  process.exit(1)
}

await QRCode.toFile('qr.png', url, {
  width: 1200,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#6E1423', light: '#FAF7F2' },
})
console.log(`qr.png → ${url}`)
