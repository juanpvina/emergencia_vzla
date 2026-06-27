import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const MOTORES = [
  { value: 'gemini', label: 'Gemini Vision', desc: 'Gemini analiza la imagen directamente. Requiere API Key. Bueno para fotos generales.' },
  { value: 'vision', label: 'Cloud Vision + Parser', desc: 'OCR de Google + parser por reglas. No necesita API Key. 1000 imágenes/mes gratis.' },
  { value: 'vision+gemini', label: 'Vision + Gemini', desc: 'Cloud Vision extrae el texto, luego Gemini lo estructura. Lo más preciso de los tres.' },
]

function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [config, setConfig] = useState(null)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/admin/config`)
      .then(r => {
        setConfig(r.data)
        setSelected(r.data.extraction_engine)
      })
      .catch(() => setMsg({ type: 'error', text: 'Error al conectar con el backend' }))
  }, [])

  const handleAuth = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await axios.post(
        `${API_BASE}/api/v1/admin/config`,
        { extraction_engine: selected || config?.extraction_engine },
        { headers: { 'x-admin-password': password } },
      )
      setAuthenticated(true)
      setMsg(null)
    } catch (err) {
      if (err.response?.status === 401) {
        setMsg({ type: 'error', text: 'Contraseña incorrecta' })
      } else {
        setMsg({ type: 'error', text: err.response?.data?.detail || 'Error de conexión' })
      }
    }
    setSaving(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await axios.post(
        `${API_BASE}/api/v1/admin/config`,
        { extraction_engine: selected },
        { headers: { 'x-admin-password': password } },
      )
      setMsg({ type: 'success', text: res.data.message })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al guardar' })
    }
    setSaving(false)
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Panel de Administración</h2>

        <div className="bg-white border rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contraseña de administrador
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="Ingresa la contraseña"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            autoFocus
          />

          {msg?.type === 'error' && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {msg.text}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={saving || !password}
            className="w-full py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-40 transition"
          >
            {saving ? 'Verificando...' : 'Entrar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Panel de Administración</h2>

      {config && (
        <div className="text-sm text-gray-500 mb-4">
          Motor actual: <span className="font-medium text-gray-800">{config.extraction_engine}</span>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {MOTORES.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setSelected(m.value)}
            className={`w-full p-4 rounded-xl border-2 text-left transition ${
              selected === m.value
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                selected === m.value
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-gray-300'
              }`}>
                {selected === m.value && (
                  <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{m.label}</div>
                <div className="text-sm text-gray-500">{m.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-40 transition"
      >
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  )
}

export default Admin
