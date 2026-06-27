import { useState, useEffect } from 'react'
import { uploadImage } from '../services/api'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const MOTORES = [
  { id: 'gemini', label: 'Gemini', icon: '🧠' },
  { id: 'vision', label: 'Cloud Vision', icon: '👁️' },
  { id: 'vision+gemini', label: 'Vision+Gemini', icon: '👁️+🧠' },
]

function Debug() {
  const [serverInfo, setServerInfo] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [results, setResults] = useState({})
  const [running, setRunning] = useState({})
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    axios.get(`${API_BASE}/health`)
      .then(r => setServerInfo(r.data))
      .catch(() => setServerInfo({ error: 'No se pudo conectar al backend' }))
  }, [])

  const handleTest = async (motor) => {
    if (!file) return
    setRunning(prev => ({ ...prev, [motor]: true }))
    setError(null)
    const start = Date.now()
    try {
      const res = await uploadImage(file, motor)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      setResults(prev => ({
        ...prev,
        [motor]: { data: res.data, elapsed, ok: true, raw: res.data.raw_respuesta },
      }))
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : detail?.detail || err.message
      setResults(prev => ({ ...prev, [motor]: { error: msg, elapsed, ok: false } }))
    }
    setRunning(prev => ({ ...prev, [motor]: false }))
  }

  const handleTestAll = async () => {
    for (const m of MOTORES) await handleTest(m.id)
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResults({})
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Debug / Test de Motores</h2>
      <p className="text-gray-500 mb-6">Prueba cada motor con la misma imagen y compara resultados.</p>

      {/* Server + file */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${serverInfo?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-400">Backend:</span>
            <span>{serverInfo?.status || 'desconectado'}</span>
            <span className="text-gray-500 ml-2">{serverInfo?.database}</span>
          </div>
          {serverInfo?.error && <div className="text-red-400 mt-1">{serverInfo.error}</div>}
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {file && <p className="mt-2 text-sm text-gray-500">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>}
        </div>
      </div>

      {preview && <img src={preview} alt="preview" className="max-h-48 rounded-lg mx-auto mb-6" />}

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {MOTORES.map(m => {
          const r = results[m.id]
          return (
            <div key={m.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-gray-900">{m.icon} {m.label}</div>
              </div>
              <button onClick={() => handleTest(m.id)} disabled={!file || running[m.id]}
                className="w-full py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-40 transition">
                {running[m.id] ? 'Ejecutando...' : 'Test'}
              </button>

              {r && (
                <div className={`mt-3 p-2 rounded text-xs ${r.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">{r.ok ? '✅ OK' : '❌ ERROR'}</span>
                    <span className="text-gray-400">{r.elapsed}s</span>
                  </div>
                  {r.ok ? (
                    <div className="text-green-700">
                      <div>Pacientes: <strong>{r.data.total_pacientes}</strong></div>
                      {r.data.advertencias?.length > 0 && (
                        <div className="text-yellow-600 mt-1">
                          {r.data.advertencias.map((a, i) => <div key={i}>⚠ {a}</div>)}
                        </div>
                      )}
                      {r.data.pacientes_creados?.length > 0 && (
                        <button onClick={() => setExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                          className="text-blue-600 hover:underline mt-1">
                          {expanded[m.id] ? 'Ocultar datos' : 'Ver datos extraídos'}
                        </button>
                      )}
                      {expanded[m.id] && r.raw?.pacientes?.map((p, i) => (
                        <div key={i} className="mt-2 p-2 bg-white rounded border text-gray-700">
                          <div><strong>{p.nombre?.valor || '?'}</strong></div>
                          <div>C.I: {p.cedula?.valor || '-'} · Edad: {p.edad?.valor || '-'}</div>
                          <div>{p.hospital?.valor || '-'} · P{p.piso?.valor || '?'} H{p.habitacion?.valor || '?'}</div>
                          <div>Estado: {p.estado_salud?.valor || '-'}</div>
                          <div className="text-gray-400">Confianza: {p.nombre?.confianza ?? '-'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-red-600 break-words">{r.error}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {file && (
        <button onClick={handleTestAll} disabled={Object.values(running).some(Boolean)}
          className="w-full py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:opacity-40 transition mb-6">
          {Object.values(running).some(Boolean) ? 'Ejecutando...' : 'Testear los 3 motores'}
        </button>
      )}

      {Object.keys(results).length >= 2 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Comparación</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Motor</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Tiempo</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Pacientes</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Adv.</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {MOTORES.filter(m => results[m.id]).map(m => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 px-2 font-medium">{m.icon} {m.label}</td>
                    <td className="py-2 px-2 text-gray-600">{results[m.id].elapsed}s</td>
                    <td className="py-2 px-2 text-gray-600">{results[m.id].data?.total_pacientes || '-'}</td>
                    <td className="py-2 px-2 text-gray-600">{results[m.id].data?.advertencias?.length || '-'}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${results[m.id].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {results[m.id].ok ? 'OK' : 'ERROR'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log de errores recientes del backend */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Log de errores recientes</h3>
        <p className="text-xs text-gray-500 mb-3">Últimos errores registrados en el backend. Solo visible en debug.</p>
        <div id="error-log" className="bg-gray-900 text-red-400 rounded-lg p-3 font-mono text-xs max-h-40 overflow-y-auto">
          {Object.entries(results).filter(([, r]) => !r.ok).length === 0 ? (
            <span className="text-green-400">Sin errores recientes</span>
          ) : (
            Object.entries(results).filter(([, r]) => !r.ok).map(([motor, r]) => (
              <div key={motor} className="mb-1">
                <span className="text-gray-400">[{motor}]</span> {r.error}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Debug
