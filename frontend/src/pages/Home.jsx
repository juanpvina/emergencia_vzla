import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listPatients, getPatientPhotoUrl } from '../services/api'

function Home() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('q')
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listPatients(15, 0)
      .then(r => setRecent(r.data.items || []))
      .catch(() => {})
      .finally(() => setLoadingRecent(false))
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    const params = new URLSearchParams({ [mode]: query.trim() })
    navigate(`/buscar?${params}`)
  }

  return (
    <div className="flex flex-col items-center py-12">
      <div className="text-center mb-10 w-full max-w-2xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Registro de Pacientes
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Busca pacientes por cédula o nombre. Sube fotos de listados o archivos Excel.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-2xl mb-10">
        <div className="flex gap-2 mb-4 justify-center">
          {[
            { value: 'q', label: 'Todo' },
            { value: 'cedula', label: 'Por Cédula' },
            { value: 'nombre', label: 'Por Nombre' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                mode === opt.value
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'cedula'
                ? 'Ej: 12345678'
                : mode === 'nombre'
                ? 'Ej: María Pérez'
                : 'Buscar por cédula o nombre...'
            }
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            autoFocus
          />
          <button
            type="submit"
            className="px-8 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition shadow-sm"
          >
            Buscar
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-12">
        <Link
          to="/subir"
          className="p-5 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition text-center"
        >
          <div className="text-3xl mb-2">📸</div>
          <div className="font-semibold text-gray-800">Subir Imagen</div>
          <div className="text-sm text-gray-500">Foto de listado hospitalario</div>
        </Link>
        <Link
          to="/subir"
          className="p-5 bg-white rounded-lg border border-gray-200 hover:border-green-400 hover:shadow-md transition text-center"
        >
          <div className="text-3xl mb-2">📊</div>
          <div className="font-semibold text-gray-800">Subir Excel</div>
          <div className="text-sm text-gray-500">Archivo con datos estructurados</div>
        </Link>
        <Link
          to="/subir"
          className="p-5 bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-md transition text-center"
        >
          <div className="text-3xl mb-2">✍️</div>
          <div className="font-semibold text-gray-800">Registrar Paciente</div>
          <div className="text-sm text-gray-500">Ingreso manual de datos</div>
        </Link>
      </div>

      {/* Últimos pacientes */}
      <div className="w-full max-w-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimos pacientes registrados</h3>
        {loadingRecent ? (
          <div className="text-center py-8">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aún no hay pacientes registrados</p>
        ) : (
          <div className="space-y-2">
            {recent.map(p => (
                <Link
                  key={p.id}
                  to={`/paciente/${p.id}`}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition"
                >
                  {p.foto_paciente_url && (
                    <img src={getPatientPhotoUrl(p.id)} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{p.nombre}</span>
                    {p.cedula && <span className="text-gray-400 ml-2 text-sm">C.I: {p.cedula}</span>}
                    {p.hospital && <span className="text-gray-400 ml-2 text-sm">· {p.hospital}</span>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
