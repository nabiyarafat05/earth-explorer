import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const INDIA_CENTER = [22.5937, 78.9629]
const INDIA_ZOOM = 5

const LAYERS = {
  trueColor: {
    label: 'True Color',
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    resolution: '250m',
    format: 'jpg',
  },
  temperature: {
    label: 'Land Surface Temperature',
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    resolution: '1km',
    format: 'png',
  },
}

function getQuakeColor(mag) {
  if (mag >= 6) return '#ff4d4d'
  if (mag >= 4) return '#ffa64d'
  return '#ffd24d'
}

function dateToStr(d) {
  return d.toISOString().split('T')[0]
}

function buildDateRange(startStr, endStr, maxFrames) {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  const step = Math.max(1, Math.ceil(totalDays / maxFrames))

  const frames = []
  let current = new Date(start)
  while (current <= end) {
    frames.push(dateToStr(current))
    current.setDate(current.getDate() + step)
  }
  if (frames[frames.length - 1] !== endStr) {
    frames.push(endStr)
  }
  return frames
}

function MapResizer({ indiaCenter, indiaZoom }) {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize()
    }, 200)
  }, [map])
  useEffect(() => {
    window.__focusIndia = () => {
      map.flyTo(indiaCenter, indiaZoom)
    }
  }, [map, indiaCenter, indiaZoom])
  return null
}

function SearchController() {
  const map = useMap()
  useEffect(() => {
    window.__flyToSearch = (lat, lon) => {
      map.flyTo([lat, lon], 8)
    }
  }, [map])
  return null
}

function ClickCoordinates() {
  const [clickPos, setClickPos] = useState(null)

  useMapEvents({
    click(e) {
      setClickPos(e.latlng)
    },
  })

  if (!clickPos) return null

  return (
    <CircleMarker
      center={clickPos}
      radius={6}
      pathOptions={{ color: '#4a9eff', fillColor: '#4a9eff', fillOpacity: 0.8 }}
    >
      <Popup>
        <div style={{ fontSize: '12px' }}>
          <strong>📍 Coordinates</strong>
          <br />
          Lat: {clickPos.lat.toFixed(4)}
          <br />
          Lng: {clickPos.lng.toFixed(4)}
        </div>
      </Popup>
    </CircleMarker>
  )
}

async function explainQuake(mag, place) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const prompt = `A magnitude ${mag} earthquake occurred near ${place}. In simple, calm language: 1) briefly explain what this means, 2) give 2-3 basic safety precautions for people in that area. Keep it under 80 words total.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  )

  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate explanation.'
}

function QuakePopup({ quake }) {
  const [explanation, setExplanation] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)

  const mag = quake.properties.mag
  const place = quake.properties.place
  const time = new Date(quake.properties.time).toLocaleDateString()

  const handleExplain = async () => {
    setLoadingAI(true)
    const result = await explainQuake(mag, place)
    setExplanation(result)
    setLoadingAI(false)
  }

  return (
    <div style={{ minWidth: '200px' }}>
      <strong>Magnitude {mag}</strong>
      <br />
      {place}
      <br />
      {time}
      <br />
      <br />
      {!explanation && (
        <button
          onClick={handleExplain}
          disabled={loadingAI}
          style={{
            background: '#4a9eff',
            color: 'white',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {loadingAI ? 'Thinking...' : '✨ Explain with AI'}
        </button>
      )}
      {explanation && (
        <div style={{ fontSize: '12px', marginTop: '6px', lineHeight: '1.4' }}>
          {explanation}
        </div>
      )}
    </div>
  )
}
function App() {
  const [date, setDate] = useState('2024-01-01')
  const [loading, setLoading] = useState(false)
  const [layerKey, setLayerKey] = useState('trueColor')
  const [quakes, setQuakes] = useState([])
  const [quakesLoading, setQuakesLoading] = useState(false)
  const [showQuakes, setShowQuakes] = useState(true)
  const [tilesLoading, setTilesLoading] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [timelapseStart, setTimelapseStart] = useState('2024-01-01')
  const [timelapseEnd, setTimelapseEnd] = useState('2024-01-10')
  const [isPlaying, setIsPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const framesRef = useRef([])
  const intervalRef = useRef(null)

  const layer = LAYERS[layerKey]
  const tileUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layer.id}/default/${date}/${layer.resolution}/{z}/{y}/{x}.${layer.format}`

  useEffect(() => {
    setQuakesLoading(true)

    const start = new Date(date)
    const end = new Date(date)
    end.setDate(end.getDate() + 1)
    const endStr = end.toISOString().split('T')[0]

    fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${date}&endtime=${endStr}&minmagnitude=3&orderby=time&limit=100`
    )
      .then((res) => res.json())
      .then((data) => {
        setQuakes(data.features || [])
        setQuakesLoading(false)
      })
      .catch((err) => {
        console.error('Earthquake fetch failed', err)
        setQuakesLoading(false)
      })
  }, [date])

  const scrollToMap = () => {
    document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' })
  }

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchText.trim()) return
    setSearching(true)
    setSearchError('')

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText)}&format=json&limit=5&addressdetails=1`
      )
      const results = await res.json()

      if (results.length === 0) {
        setSearchError('Place not found')
      } else {
        const cityMatch = results.find(
          (r) => r.type === 'city' || r.type === 'administrative' || r.class === 'place'
        )
        const best = cityMatch || results[0]
        window.__flyToSearch && window.__flyToSearch(parseFloat(best.lat), parseFloat(best.lon))
      }
    } catch (err) {
      setSearchError('Search failed')
    }

    setSearching(false)
  }

  const startTimelapse = () => {
    if (timelapseStart >= timelapseEnd) {
      return
    }
    const frames = buildDateRange(timelapseStart, timelapseEnd, 12)
    framesRef.current = frames
    setFrameIndex(0)
    setDate(frames[0])
    setIsPlaying(true)
  }

  const stopTimelapse = () => {
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    if (!isPlaying) return

    intervalRef.current = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1
        if (next >= framesRef.current.length) {
          clearInterval(intervalRef.current)
          setIsPlaying(false)
          return prev
        }
        setDate(framesRef.current[next])
        setLoading(true)
        return next
      })
    }, 1500)

    return () => clearInterval(intervalRef.current)
  }, [isPlaying])

  const totalQuakes = quakes.length
  const highestMag = quakes.length
    ? Math.max(...quakes.map((q) => q.properties.mag)).toFixed(1)
    : '—'
  const avgMag = quakes.length
    ? (quakes.reduce((sum, q) => sum + q.properties.mag, 0) / quakes.length).toFixed(1)
    : '—'

  return (
    <div className={theme === 'light' ? 'light-mode' : ''}>
      <header className="navbar">
        <div className="navbar-logo">🌍 Earth Explorer</div>
        <nav className="navbar-links">
          <a onClick={scrollToMap}>Map</a>
          <a href="#about-section">About</a>
          <a onClick={toggleTheme}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</a>
        </nav>
      </header>

      <section className="hero">
        <h1>Explore Earth from Space</h1>
        <p>
          Live NASA satellite imagery, real-time earthquake data, and AI-powered
          disaster insights, all in one interactive map.
        </p>
        <button className="hero-button" onClick={scrollToMap}>
          Launch Map ↓
        </button>
      </section>

      <section id="map-section" className="map-section">
        <div className="map-wrapper">
          <div className="sidebar">
            <h1 className="app-title">🌍 Earth Explorer</h1>
            <p className="app-subtitle">Live NASA satellite &amp; disaster data</p>

            <div className="control-group">
              <label className="control-label">Search Location</label>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  className="control-input"
                  placeholder="e.g. Mumbai, Tokyo..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={searching}
                  style={{
                    background: '#4a9eff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {searching ? '...' : 'Go'}
                </button>
              </form>
              {searchError && (
                <p style={{ fontSize: '11px', color: '#ff8080', margin: '4px 0 0' }}>
                  {searchError}
                </p>
              )}
            </div>

            <div className="control-group">
              <label className="control-label">Date</label>
              <input
                type="date"
                className="control-input"
                value={date}
                max="2026-07-27"
                disabled={isPlaying}
                onChange={(e) => {
                  setDate(e.target.value)
                  setLoading(true)
                }}
              />
            </div>

            <div className="control-group">
              <label className="control-label">Satellite Layer</label>
              <select
                className="control-select"
                value={layerKey}
                onChange={(e) => {
                  setLayerKey(e.target.value)
                  setLoading(true)
                }}
              >
                {Object.entries(LAYERS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showQuakes}
                  onChange={(e) => setShowQuakes(e.target.checked)}
                />
                Show Earthquakes {quakesLoading ? '(loading...)' : `(${totalQuakes} on this date)`}
              </label>
            </div>

            <button
              onClick={() => window.__focusIndia && window.__focusIndia()}
              style={{
                width: '100%',
                background: 'rgba(255, 153, 51, 0.15)',
                color: '#ffb366',
                border: '1px solid rgba(255, 153, 51, 0.3)',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                marginBottom: '16px',
              }}
            >
              Focus India
            </button>

            <div className="divider" />

            <div className="control-group">
              <label className="control-label">🎬 Time-Lapse</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input
                  type="date"
                  className="control-input"
                  value={timelapseStart}
                  max="2026-07-27"
                  disabled={isPlaying}
                  onChange={(e) => setTimelapseStart(e.target.value)}
                />
                <input
                  type="date"
                  className="control-input"
                  value={timelapseEnd}
                  max="2026-07-27"
                  disabled={isPlaying}
                  onChange={(e) => setTimelapseEnd(e.target.value)}
                />
              </div>
              {!isPlaying ? (
                <button
                  onClick={startTimelapse}
                  style={{
                    width: '100%',
                    background: 'rgba(74, 158, 255, 0.15)',
                    color: '#4a9eff',
                    border: '1px solid rgba(74, 158, 255, 0.3)',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  ▶ Play Time-Lapse
                </button>
              ) : (
                <button
                  onClick={stopTimelapse}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 77, 77, 0.15)',
                    color: '#ff8080',
                    border: '1px solid rgba(255, 77, 77, 0.3)',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  ⏹ Stop ({frameIndex + 1}/{framesRef.current.length})
                </button>
              )}
            </div>

            <div className="divider" />

            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-number">{totalQuakes}</div>
                <div className="stat-label">Total Quakes</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{highestMag}</div>
                <div className="stat-label">Highest Mag</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{avgMag}</div>
                <div className="stat-label">Avg Mag</div>
              </div>
            </div>

            <div className="divider" />

            <div className="legend">
              <span className="control-label" style={{ marginBottom: 2 }}>
                Earthquake Magnitude
              </span>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#ffd24d' }} />
                3.0 – 4.9
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#ffa64d' }} />
                5.0 – 5.9
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#ff4d4d' }} />
                6.0+
              </div>
            </div>

            {loading && (
              <div className="status-badge">
                <span className="pulse" />
                Loading imagery...
              </div>
            )}
          </div>
          {tilesLoading && (
            <div className="map-spinner">
              <span className="spinner-ring" />
              Loading tiles...
            </div>
          )}

          <MapContainer
            center={INDIA_CENTER}
            zoom={INDIA_ZOOM}
            maxZoom={9}
            style={{ height: '100%', width: '100%' }}
          >
            <MapResizer indiaCenter={INDIA_CENTER} indiaZoom={INDIA_ZOOM} />
            <SearchController />
            <ClickCoordinates />
            <CircleMarker
              center={INDIA_CENTER}
              radius={120}
              pathOptions={{
                color: '#ff9933',
                fillColor: '#ff9933',
                fillOpacity: 0.05,
                weight: 1.5,
                dashArray: '6 6',
              }}
            />
            <TileLayer
              key={date + layerKey}
              url={tileUrl}
              attribution="NASA GIBS"
              eventHandlers={{
                loading: () => setTilesLoading(true),
                load: () => {
                  setLoading(false)
                  setTilesLoading(false)
                },
              }}
            />

            {showQuakes &&
              quakes.map((quake) => {
                const [lon, lat] = quake.geometry.coordinates
                const mag = quake.properties.mag

                return (
                  <CircleMarker
                    key={quake.id}
                    center={[lat, lon]}
                    radius={Math.max(mag * 2, 4)}
                    pathOptions={{
                      color: getQuakeColor(mag),
                      fillColor: getQuakeColor(mag),
                      fillOpacity: 0.6,
                      weight: 1,
                    }}
                  >
                    <Popup>
                      <QuakePopup quake={quake} />
                    </Popup>
                  </CircleMarker>
                )
              })}
          </MapContainer>
        </div>
      </section>

      <section id="about-section" className="about">
        <h2>What This Project Does</h2>
        <p className="about-sub">
          Built for BSERC using real NASA and USGS data sources.
        </p>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>🛰️ Live Satellite Imagery</h3>
            <p>View NASA's True Color and Land Surface Temperature imagery for any date.</p>
          </div>
          <div className="feature-card">
            <h3>🌍 Date-Specific Earthquakes</h3>
            <p>See earthquakes that actually happened on your selected date, sourced from USGS.</p>
          </div>
          <div className="feature-card">
            <h3>✨ AI-Powered Insights</h3>
            <p>Click any earthquake to get a simple, AI-generated explanation and safety tips.</p>
          </div>
        </div>
      </section>

      <section className="missions">
        <div className="missions-inner">
          <h2>Space Missions</h2>
          <p className="missions-sub">
            Key ISRO and NASA missions behind the data and imagery used in this project.
          </p>
          <div className="mission-grid">
            <div className="mission-card">
              <span className="mission-agency isro">ISRO</span>
              <h3>Chandrayaan-3</h3>
              <p>
                India's third lunar mission, which successfully landed near the Moon's
                south pole in 2023, the first mission ever to do so.
              </p>
            </div>
            <div className="mission-card">
              <span className="mission-agency isro">ISRO</span>
              <h3>Aditya-L1</h3>
              <p>
                India's first dedicated solar observatory, studying the Sun from a
                stable orbit point between Earth and the Sun.
              </p>
            </div>
            <div className="mission-card">
              <span className="mission-agency nasa">NASA</span>
              <h3>Terra &amp; Aqua (MODIS)</h3>
              <p>
                The satellites providing the true-color and temperature imagery shown
                on this map, in orbit since the early 2000s.
              </p>
            </div>
            <div className="mission-card">
              <span className="mission-agency nasa">NASA</span>
              <h3>Landsat Program</h3>
              <p>
                The longest-running Earth observation program, providing continuous
                satellite imagery of Earth's surface since 1972.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        Built with NASA GIBS and USGS open data. Earth Explorer Project 2026.
      </footer>
    </div>
  )
}

export default App