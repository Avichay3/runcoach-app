export function parseGPX(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('קובץ GPX לא תקין')
  }

  const points = Array.from(doc.querySelectorAll('trkpt'))
  if (points.length < 2) throw new Error('קובץ ריק או לא תקין')

  // Distance via Haversine
  let totalMeters = 0
  for (let i = 1; i < points.length; i++) {
    totalMeters += haversine(
      parseFloat(points[i - 1].getAttribute('lat')),
      parseFloat(points[i - 1].getAttribute('lon')),
      parseFloat(points[i].getAttribute('lat')),
      parseFloat(points[i].getAttribute('lon')),
    )
  }
  const distanceKm = Math.round(totalMeters / 100) / 10

  // Duration
  const times = points.map(p => p.querySelector('time')?.textContent).filter(Boolean)
  let durationSec = 0
  let timeText = ''
  if (times.length >= 2) {
    durationSec = Math.round((new Date(times[times.length - 1]) - new Date(times[0])) / 1000)
    const h = Math.floor(durationSec / 3600)
    const m = Math.floor((durationSec % 3600) / 60)
    const s = durationSec % 60
    timeText = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }

  // Heart rate
  const hrValues = Array.from(doc.querySelectorAll('hr, gpxtpx\\:hr, ns3\\:hr'))
    .map(el => parseInt(el.textContent))
    .filter(v => !isNaN(v) && v > 40 && v < 230)

  const avgHr = hrValues.length
    ? Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length)
    : null
  const maxHr = hrValues.length ? Math.max(...hrValues) : null

  // Pace (min:sec per km)
  let pace = ''
  if (distanceKm > 0 && durationSec > 0) {
    const secPerKm = durationSec / distanceKm
    const pm = Math.floor(secPerKm / 60)
    const ps = Math.round(secPerKm % 60)
    pace = `${pm}:${String(ps).padStart(2, '0')}`
  }

  // Activity name (optional)
  const name = doc.querySelector('name')?.textContent || ''

  return { distanceKm, timeText, avgHr, maxHr, pace, name }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
