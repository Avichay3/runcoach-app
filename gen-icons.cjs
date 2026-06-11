// Generates PNG icons for PWA
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0)
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

function makePNG(size) {
  // Orange background (#F05627) with a white rounded rectangle center (simple logo)
  const R = 0xF0, G = 0x56, B = 0x27
  const radius = Math.round(size * 0.22)

  const rowBytes = 1 + size * 3
  const raw = Buffer.alloc(size * rowBytes, 0)

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0 // filter None
    for (let x = 0; x < size; x++) {
      // Rounded rect clip
      const dx = Math.max(0, Math.max(radius - x, x - (size - 1 - radius)))
      const dy = Math.max(0, Math.max(radius - y, y - (size - 1 - radius)))
      const inside = dx * dx + dy * dy <= radius * radius

      const px = y * rowBytes + 1 + x * 3
      if (inside) {
        raw[px] = R; raw[px + 1] = G; raw[px + 2] = B
      } else {
        // White outside rounded rect
        raw[px] = 0xFF; raw[px + 1] = 0xFF; raw[px + 2] = 0xFF
      }
    }
  }

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const dir = path.join(__dirname, 'public')
fs.writeFileSync(path.join(dir, 'icon-192.png'), makePNG(192))
fs.writeFileSync(path.join(dir, 'icon-512.png'), makePNG(512))
console.log('Icons created: icon-192.png, icon-512.png')
