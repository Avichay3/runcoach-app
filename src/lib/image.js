// Downscale + compress an image file to a JPEG blob before upload.
// iPhone photos are often HEIC, which most browsers can't decode in <canvas>;
// we convert those to JPEG first (heic2any is loaded on demand).
export async function compressImage(file, maxDim = 1280, quality = 0.82) {
  const input = await maybeConvertHeic(file)
  return canvasCompress(input, maxDim, quality)
}

function isHeic(file) {
  return /heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '')
}

async function maybeConvertHeic(file) {
  if (!isHeic(file)) return file
  const { default: heic2any } = await import('heic2any')
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  return Array.isArray(out) ? out[0] : out
}

function canvasCompress(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('compress failed'))),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('קובץ תמונה לא תקין'))
    }
    img.src = url
  })
}
