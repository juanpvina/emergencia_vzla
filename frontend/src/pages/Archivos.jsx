import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listUploads, getUploadDetail, updatePatient, deletePatient, getUploadImageUrl, submitVerification, createPatient } from '../services/api'

function generateFingerprint() {
  const data = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset(), navigator.hardwareConcurrency || '', navigator.platform || ''].join('|')
  let hash = 0
  for (let i = 0; i < data.length; i++) { const c = data.charCodeAt(i); hash = ((hash << 5) - hash) + c; hash |= 0 }
  return 'fp_' + Math.abs(hash).toString(36).slice(0, 16)
}

const fingerprint = generateFingerprint()

function Archivos() {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editPaciente, setEditPaciente] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [msg, setMsg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selecting, setSelecting] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    nombre: '', cedula: '', hospital: '', piso: '', habitacion: '', edad: '', estado_salud: '', contacto: '',
  })
  const imgRef = useRef(null)

  const verifiedCount = (pcs) => pcs?.filter(p => p.status_verificacion === 'verificado').length || 0

  useEffect(() => {
    listUploads(20, 0)
      .then(r => {
        setUploads(r.data.items || [])
        setHasMore((r.data.items || []).length >= 20)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      const r = await listUploads(20, uploads.length)
      const newItems = r.data.items || []
      setUploads(prev => [...prev, ...newItems])
      setHasMore(newItems.length >= 20)
    } catch {}
    setLoadingMore(false)
  }

  const handleSelect = async (id) => {
    if (selecting) return
    setSelecting(id)
    setSelected(null)
    setEditPaciente(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    try {
      const res = await getUploadDetail(id)
      setSelected(res.data)
    } catch {
      setMsg({ type: 'error', text: 'Error al cargar detalles' })
    } finally {
      setSelecting(null)
    }
  }

  const handleEdit = (p) => {
    setEditPaciente(p.id)
    setEditForm({
      nombre: p.nombre || '',
      cedula: p.cedula || '',
      hospital: p.hospital || '',
      piso: p.piso || '',
      habitacion: p.habitacion || '',
      edad: p.edad || '',
      estado_salud: p.estado_salud || '',
      contacto: p.contacto || '',
    })
  }

  const handleSave = async () => {
    try {
      const payload = { ...editForm }
      if (payload.edad) payload.edad = parseInt(payload.edad)
      else payload.edad = null
      await updatePatient(editPaciente, payload)
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
        setSelected({ ...selected, pacientes: selected.pacientes.filter(p => p.id !== id) })
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al eliminar' })
    }
  }

  const handleAddPatient = async () => {
    if (!addForm.nombre.trim()) return
    try {
      const payload = { ...addForm }
      if (payload.edad) payload.edad = parseInt(payload.edad)
      else payload.edad = null
      if (!payload.cedula) payload.cedula = null
      await createPatient(payload)
      setMsg({ type: 'success', text: 'Paciente añadido' })
      setShowAddForm(false)
      setAddForm({ nombre: '', cedula: '', hospital: '', piso: '', habitacion: '', edad: '', estado_salud: '', contacto: '' })
      if (selected) handleSelect(selected.id)
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al añadir' })
    }
  }

  const handleVote = async (pacienteId, tipo) => {
    try {
      await submitVerification(pacienteId, { tipo, verificador_id: fingerprint })
      if (selected) {
        const updatePacientes = selected.pacientes.map(p =>
          p.id === pacienteId
            ? { ...p, status_verificacion: tipo === 'confirmar' ? 'verificado' : 'error', total_confirmaciones: tipo === 'confirmar' ? (p.total_confirmaciones || 0) + 1 : (p.total_confirmaciones || 0), total_reportes: tipo === 'reportar_error' ? (p.total_reportes || 0) + 1 : (p.total_reportes || 0) }
            : p
        )
        setSelected({ ...selected, pacientes: updatePacientes })
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setMsg({ type: 'error', text: 'Ya votaste este paciente' })
      } else {
        setMsg({ type: 'error', text: 'Error al votar' })
      }
    }
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.max(0.5, Math.min(5, z + delta)))
  }

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
  }

  const handleMouseUp = () => setIsPanning(false)

  useEffect(() => {
    const img = imgRef.current
    if (img) {
      img.addEventListener('wheel', handleWheel, { passive: false })
      return () => img.removeEventListener('wheel', handleWheel)
    }
  }, [selected])

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Archivos subidos</h2>
      <p className="text-gray-500 mb-6">Seleccioná un archivo para ver su imagen y los pacientes detectados.</p>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Lista de uploads */}
        <div>
          {loading ? (
            <div className="text-center py-8"><div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : uploads.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Aún no hay archivos subidos</p>
          ) : (
            <div className="space-y-2">
              {uploads.map(u => {
                const vc = verifiedCount(u.pacientes)
                const pct = u.total_pacientes > 0 ? Math.round(vc / u.total_pacientes * 100) : 0
                return (
                <button key={u.id} onClick={() => handleSelect(u.id)} disabled={selecting === u.id} className={`w-full text-left p-3 rounded-lg border transition ${selected?.id === u.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'} ${selecting === u.id ? 'opacity-60 cursor-wait' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-sm text-gray-900">{u.total_pacientes} pacientes</span>
                      <span className="text-xs text-gray-400 ml-2">{u.motor}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                  {u.hospitales?.length > 0 && <div className="text-xs text-gray-500 mt-1">{u.hospitales.join(', ')}</div>}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{vc}/{u.total_pacientes}</span>
                    {selecting === u.id && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                  </div>
                </button>
              )})}
            </div>
          )}
          {hasMore && !loading && (
            <button onClick={handleLoadMore} disabled={loadingMore} className="w-full mt-3 py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg text-sm font-medium hover:border-gray-400 hover:text-gray-700 disabled:opacity-40 transition">
              {loadingMore ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </div>

        {/* Split screen */}
        <div className="md:col-span-2">
          {selected ? (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Imagen con zoom */}
              <div
                ref={imgRef}
                className="bg-gray-900 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing relative"
                style={{ height: '60vh', minHeight: 400 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={getUploadImageUrl(selected.id)}
                  alt="Listado original"
                  className="max-w-none absolute"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                  }}
                  draggable={false}
                />
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {Math.round(zoom * 100)}% · Scroll para zoom
                </div>
              </div>

              {/* Lista de pacientes */}
              <div className="bg-white border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: '60vh', minHeight: 400 }}>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  Pacientes ({selected.pacientes?.length || 0})
                  <span className="text-xs text-gray-400 font-normal">{selected.motor}</span>
                </h3>
                <button onClick={() => { setShowAddForm(!showAddForm); setEditPaciente(null) }} className="w-full mb-3 py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition">
                  {showAddForm ? 'Cancelar' : '+ Añadir paciente'}
                </button>
                {showAddForm && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                    <input value={addForm.nombre} onChange={e => setAddForm({...addForm, nombre: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Nombre *" autoFocus />
                    <input value={addForm.cedula} onChange={e => setAddForm({...addForm, cedula: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Cédula" />
                    <input value={addForm.hospital} onChange={e => setAddForm({...addForm, hospital: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Hospital" />
                    <div className="flex gap-2">
                      <input value={addForm.piso} onChange={e => setAddForm({...addForm, piso: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Piso" />
                      <input value={addForm.habitacion} onChange={e => setAddForm({...addForm, habitacion: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Hab" />
                    </div>
                    <div className="flex gap-2">
                      <input value={addForm.edad} onChange={e => setAddForm({...addForm, edad: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Edad" />
                      <input value={addForm.contacto} onChange={e => setAddForm({...addForm, contacto: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Contacto" />
                    </div>
                    <input value={addForm.estado_salud} onChange={e => setAddForm({...addForm, estado_salud: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Estado de salud" />
                    <button onClick={handleAddPatient} disabled={!addForm.nombre.trim()} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-40">Guardar paciente</button>
                  </div>
                )}
                <div className="space-y-2">
                  {selected.pacientes?.map(p => (
                    <div key={p.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {editPaciente === p.id ? (
                        <div className="space-y-2">
                          <input value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Nombre" />
                          <input value={editForm.cedula} onChange={e => setEditForm({...editForm, cedula: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Cédula" />
                          <input value={editForm.hospital} onChange={e => setEditForm({...editForm, hospital: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Hospital" />
                          <div className="flex gap-2">
                            <input value={editForm.piso} onChange={e => setEditForm({...editForm, piso: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Piso" />
                            <input value={editForm.habitacion} onChange={e => setEditForm({...editForm, habitacion: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Hab" />
                          </div>
                          <div className="flex gap-2">
                            <input value={editForm.edad} onChange={e => setEditForm({...editForm, edad: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Edad" />
                            <input value={editForm.contacto} onChange={e => setEditForm({...editForm, contacto: e.target.value})} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Contacto" />
                          </div>
                          <input value={editForm.estado_salud} onChange={e => setEditForm({...editForm, estado_salud: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" placeholder="Estado de salud" />
                          <div className="flex gap-2">
                            <button onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Guardar</button>
                            <button onClick={() => setEditPaciente(null)} className="px-3 py-1 bg-gray-200 rounded text-xs">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <Link to={`/paciente/${p.id}`} className="font-medium text-sm text-gray-900 hover:underline">{p.nombre}</Link>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {p.cedula && <span>C.I: {p.cedula}</span>}
                                {p.edad && <span className="ml-2">· {p.edad} años</span>}
                                {p.hospital && <span className="ml-2">· {p.hospital}</span>}
                              </div>
                              <div className="text-xs text-gray-400">
                                {p.piso && <span>P{p.piso}</span>}{p.habitacion && <span> H{p.habitacion}</span>}
                                {p.estado_salud && <span className="ml-2">· {p.estado_salud}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => handleVote(p.id, 'confirmar')} className="px-1.5 py-1 text-xs text-green-600 hover:bg-green-50 rounded" title="Confirmar">✅</button>
                              <button onClick={() => handleVote(p.id, 'reportar_error')} className="px-1.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded" title="Reportar error">❌</button>
                              <button onClick={() => handleEdit(p)} className="px-1.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">✏️</button>
                              <button onClick={() => handleDelete(p.id)} className="px-1.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded">🗑️</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {selected.pacientes?.length === 0 && <p className="text-gray-400 text-center py-4 text-sm">Sin pacientes en este archivo</p>}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400 text-sm">
              Seleccioná un archivo para ver su imagen y pacientes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Archivos
