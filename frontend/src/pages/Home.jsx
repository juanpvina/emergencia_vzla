import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

function Home() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('q')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    const params = new URLSearchParams({ [mode]: query.trim() })
    navigate(`/buscar?${params}`)
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Registro de Pacientes
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Centraliza listados hospitalarios. Busca pacientes por cédula o nombre.
          Sube fotos de listados o archivos Excel para extraer datos automáticamente.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-2xl">
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

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
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
          to="/registrar"
          className="p-5 bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-md transition text-center"
        >
          <div className="text-3xl mb-2">✍️</div>
          <div className="font-semibold text-gray-800">Registrar Paciente</div>
          <div className="text-sm text-gray-500">Ingreso manual de datos</div>
        </Link>
      </div>
    </div>
  )
}

export default Home
