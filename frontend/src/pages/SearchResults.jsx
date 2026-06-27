import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { searchPatients } from '../services/api'

function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cedula = searchParams.get('cedula') || ''
  const nombre = searchParams.get('nombre') || ''
  const q = searchParams.get('q') || ''

  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cedula && !nombre && !q) {
      navigate('/')
      return
    }
    setLoading(true)
    searchPatients({ cedula, nombre, q })
      .then((res) => {
        setResults(res.data.resultados || [])
        setTotal(res.data.total || 0)
        setMensaje(res.data.mensaje || '')
      })
      .catch(() => setMensaje('Error al buscar'))
      .finally(() => setLoading(false))
  }, [cedula, nombre, q])

  const queryDisplay = cedula || nombre || q || ''

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Resultados</h2>
        <span className="text-gray-500">"{queryDisplay}"</span>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="mt-3 text-gray-500">Buscando...</p>
        </div>
      )}

      {!loading && mensaje && results.length === 0 && (
        <div className="text-center py-12 bg-white border rounded-xl">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-600">{mensaje}</p>
          <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Volver a buscar
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} paciente(s) encontrado(s)</p>
          <div className="space-y-3">
            {results.map((p) => (
              <Link
                key={p.id}
                to={`/paciente/${p.id}`}
                className="block bg-white border rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  {p.foto_paciente_url?.startsWith('http') && (
                    <img src={p.foto_paciente_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{p.nombre}</h3>
                    <div className="flex gap-3 mt-1 text-sm text-gray-500">
                      {p.cedula && <span>CI: {p.cedula}</span>}
                      {p.hospital && <span>{p.hospital}</span>}
                      {p.piso && p.habitacion && (
                        <span>Piso {p.piso}, Hab {p.habitacion}</span>
                      )}
                    </div>
                    {p.estado_salud && (
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                        p.estado_salud.toLowerCase() === 'estable' || p.estado_salud.toLowerCase() === 'mejoría' || p.estado_salud.toLowerCase() === 'alta médica'
                          ? 'bg-green-100 text-green-700'
                          : p.estado_salud.toLowerCase() === 'grave' || p.estado_salud.toLowerCase() === 'crítico'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.estado_salud}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      p.status_verificacion === 'verificado'
                        ? 'bg-green-100 text-green-700'
                        : p.status_verificacion === 'parcial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : p.status_verificacion === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status_verificacion === 'no_verificado' ? 'Sin verificar' : p.status_verificacion}
                    </span>
                    {p.confianza_global != null && (
                      <div className="text-xs text-gray-400 mt-1">
                        Confianza: {(p.confianza_global * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  </div>
                </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default SearchResults
