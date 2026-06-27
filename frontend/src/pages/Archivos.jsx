import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listUploads, getUploadDetail, updatePatient, deletePatient, getPatientImageUrl } from '../services/api'

function Archivos() {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editPaciente, setEditPaciente] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    listUploads(50, 0)
      .then(r => setUploads(r.data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (id) => {
    setSelected(null)
    setEditPaciente(null)
    try {
      const res = await getUploadDetail(id)
      setSelected(res.data)
    } catch {
      setMsg({ type: 'error', text: 'Error al cargar detalles' })
    }
  }

  const handleEdit = (p) => {
    setEditPaciente(p.id)
    setEditForm({
      nombre: p.nombre || '',
      cedula: p.cedula || '',
      hospital: p.hospital || '',
    })
  }

  const handleSave = async () => {
    try {
      await updatePatient(editPaciente, editForm)
      setMsg({ type: 'success', text: 'Paciente actualizado' })
      setEditPaciente(null)
      if (selected) handleSelect(selected.id)
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al actualizar' })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este paciente y todos sus datos?')) return
    try {
      await deletePatient(id)
      setMsg({ type: 'success', text: 'Paciente eliminado' })
      if (selected) {
        setSelected({
          ...selected,
          pacientes: selected.pacientes.filter(p => p.id !== id),
        })
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al eliminar' })
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Archivos subidos</h2>
      <p className="text-gray-500 mb-6">Imágenes subidas al sistema. Haz clic para ver los pacientes detectados.</p>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista de uploads */}
        <div>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : uploads.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Aún no hay archivos subidos</p>
          ) : (
            <div className="space-y-2">
              {uploads.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selected?.id === u.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-sm text-gray-900">{u.total_pacientes} pacientes</span>
                      <span className="text-xs text-gray-400 ml-2">{u.motor}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {u.hospitales?.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">{u.hospitales.join(', ')}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle del upload */}
        <div>
          {selected ? (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                Pacientes ({selected.pacientes?.length || 0})
              </h3>
              <div className="space-y-2">
                {selected.pacientes?.map(p => (
                  <div key={p.id} className="p-3 bg-gray-50 rounded-lg">
                    {editPaciente === p.id ? (
                      <div className="space-y-2">
                        <input value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" />
                        <input value={editForm.cedula} onChange={e => setEditForm({...editForm, cedula: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" />
                        <input value={editForm.hospital} onChange={e => setEditForm({...editForm, hospital: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" />
                        <div className="flex gap-2">
                          <button onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Guardar</button>
                          <button onClick={() => setEditPaciente(null)} className="px-3 py-1 bg-gray-200 rounded text-xs">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Link to={`/paciente/${p.id}`} className="hover:underline">
                          <div className="font-medium text-sm text-gray-900">{p.nombre}</div>
                          <div className="text-xs text-gray-500">
                            {p.cedula && <span>C.I: {p.cedula}</span>}
                            {p.hospital && <span className="ml-2">· {p.hospital}</span>}
                          </div>
                        </Link>
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(p)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">✏️</button>
                          <button onClick={() => handleDelete(p.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400 text-sm">
              Selecciona un archivo para ver sus pacientes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Archivos
