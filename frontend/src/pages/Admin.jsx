import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''
const MOTORES = [
  { value: 'gemini', label: 'Gemini Vision', icon: '🧠', desc: 'Imagen completa a Gemini AI' },
  { value: 'vision', label: 'Cloud Vision + Parser', icon: '👁️', desc: 'OCR + reglas (sin IA, gratis)' },
  { value: 'vision+gemini', label: 'Vision + Gemini', icon: '👁️+🧠', desc: 'OCR + IA estructura texto' },
]

function Admin() {
  const [config, setConfig] = useState(null)
  const [password, setPassword] = useState('')
  const [auth, setAuth] = useState(false)
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
      setAuth(true)
    } catch (err) {
      if (err.response?.status === 401) {
        setMsg({ type: 'error', text: 'Contraseña incorrecta' })
      } else {
        setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al guardar' })
      }
    }
    setSaving(false)
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Panel de Administración</h2>
      <p className="text-gray-500 mb-6">Configura el motor de extracción global para todas las subidas.</p>

      {config && (
        <div className="mb-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
          Motor actual del servidor: <strong>{config.extraction_engine}</strong>
          {config.default_engine && (
            <span className="text-gray-400 ml-2">
              (default: {config.default_engine})
            </span>
          )}
        </div>
      )}

      {!auth && (
        <div className="mb-6 p-4 bg-white border rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contraseña de administrador
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Ingresa la contraseña del .env"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
                <div className="font-semibold text-gray-900">{m.icon} {m.label}</div>
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
        disabled={saving || !password}
        className="w-full py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-40 transition"
      >
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </button>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <p className="font-medium mb-1">💡 ¿Cómo funciona?</p>
        <p>El motor seleccionado se guarda en Firestore y se usa como predeterminado en la página de Subir. Los usuarios aún pueden cambiarlo manualmente por subida.</p>
      </div>
    </div>
  )
}

export default Admin
