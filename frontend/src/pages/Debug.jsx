import { useState, useEffect } from 'react'
import { uploadImage } from '../services/api'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const MOTORES = [
  { id: 'gemini', label: 'Gemini', icon: '🧠', desc: 'Vision directo (API Key)' },
  { id: 'vision', label: 'Cloud Vision', icon: '👁️', desc: 'OCR + parser (gratis)' },
  { id: 'vision+gemini', label: 'Vision+Gemini', icon: '👁️+🧠', desc: 'OCR + IA estructura' },
]

function Debug() {
  const [serverInfo, setServerInfo] = useState(null)
  const [file, setFile] = useState(null)
  const [results, setResults] = useState({})
  const [running, setRunning] = useState({})
  const [error, setError] = useState(null)

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
        [motor]: {
          ...res.data,
          elapsed,
          ok: true,
        },
      }))
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      setResults(prev => ({
        ...prev,
        [motor]: {
          error: err.response?.data?.detail || err.message,
          elapsed,
          ok: false,
        },
      }))
    }
    setRunning(prev => ({ ...prev, [motor]: false }))
  }

  const handleTestAll = async () => {
    for (const m of MOTORES) {
      await handleTest(m.id)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Debug / Test de Motores</h2>
      <p className="text-gray-500 mb-6">Prueba cada motor de extracción con la misma imagen.</p>

      {/* Server info */}
      <div className="mb-6 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-block w-2 h-2 rounded-full ${serverInfo?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-gray-400">Backend:</span>
          <span>{serverInfo?.status || 'desconectado'}</span>
          <span className="text-gray-500 ml-2">{serverInfo?.database}</span>
        </div>
        {serverInfo?.error && <div className="text-red-400">{serverInfo.error}</div>}
      </div>

      {/* File selector */}
      <div className="mb-6 p-4 bg-white border rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Imagen de prueba:
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files[0])
            setResults({})
            setError(null)
          }}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <p className="mt-2 text-sm text-gray-500">
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      {/* Motor cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {MOTORES.map((m) => (
          <div key={m.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold text-gray-900">{m.icon} {m.label}</div>
                <div className="text-xs text-gray-400">{m.desc}</div>
              </div>
            </div>
            <button
              onClick={() => handleTest(m.id)}
              disabled={!file || running[m.id]}
              className="w-full py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-40 transition"
            >
              {running[m.id] ? 'Ejecutando...' : `Test ${m.label}`}
            </button>

            {results[m.id] && (
              <div className={`mt-3 p-2 rounded text-xs ${
                results[m.id].ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{results[m.id].ok ? 'OK' : 'ERROR'}</span>
                  <span className="text-gray-400">{results[m.id].elapsed}s</span>
                </div>
                {results[m.id].ok ? (
                  <div className="text-green-700">
                    Pacientes: <strong>{results[m.id].total_pacientes}</strong>
                    {results[m.id].advertencias?.length > 0 && (
                      <span className="text-yellow-600 ml-1">
                        ({results[m.id].advertencias.length} adv)
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600 truncate">{results[m.id].error}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Test all button */}
      {file && (
        <button
          onClick={handleTestAll}
          disabled={Object.values(running).some(Boolean)}
          className="w-full py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:opacity-40 transition mb-6"
        >
          Testear los 3 motores
        </button>
      )}

      {/* Side-by-side comparison */}
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
                {MOTORES.filter(m => results[m.id]).map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 px-2 font-medium">{m.icon} {m.label}</td>
                    <td className="py-2 px-2 text-gray-600">{results[m.id].elapsed}s</td>
                    <td className="py-2 px-2 text-gray-600">{results[m.id]?.total_pacientes || '-'}</td>
                    <td className="py-2 px-2 text-gray-600">{results[m.id]?.advertencias?.length || '-'}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        results[m.id].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
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

      {/* Info box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-1">¿Cómo funciona?</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li><strong>Gemini</strong>: La imagen se envía completa a Gemini Vision. Requiere API Key.</li>
          <li><strong>Cloud Vision</strong>: Google Cloud Vision extrae el texto. Un parser rule-based lo estructura. Sin IA.</li>
          <li><strong>Vision+Gemini</strong>: Cloud Vision extrae texto. Gemini solo estructura (más barato que enviar imagen).</li>
        </ul>
        <p className="mt-2 text-blue-600">
          Primera prueba gratis: Cloud Vision incluye 1000 unidades/mes sin costo.
          Gemini: cuota gratuita diaria desde aistudio.google.com.
        </p>
      </div>
    </div>
  )
}

export default Debug
