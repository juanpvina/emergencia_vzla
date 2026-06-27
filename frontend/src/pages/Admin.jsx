import { useState, useEffect } from 'react'
import axios from 'axios'
import { uploadImage, listUploads, deleteUpload } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

const MOTORES = [
  { value: 'gemini', label: 'Gemini Vision', desc: 'Gemini analiza la imagen directamente. Requiere API Key.' },
  { value: 'vision', label: 'Cloud Vision + Parser', desc: 'OCR de Google + parser por reglas. No necesita API Key. 1000 imágenes/mes gratis.' },
  { value: 'vision+gemini', label: 'Vision + Gemini', desc: 'Cloud Vision extrae el texto, luego Gemini lo estructura.' },
  { value: 'vision+gemini+image', label: 'Vision + Gemini + Imagen', desc: 'Cloud Vision OCR + Gemini con imagen y texto. Lo más preciso (y más caro).' },
]

function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [config, setConfig] = useState(null)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const [serverInfo, setServerInfo] = useState(null)
  const [testFile, setTestFile] = useState(null)
  const [testPreview, setTestPreview] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [testRunning, setTestRunning] = useState({})
  const [testExpanded, setTestExpanded] = useState({})
  const [ocrLines, setOcrLines] = useState(null)
  const [loadingOcr, setLoadingOcr] = useState(false)
  const [contexto, setContexto] = useState('')
  const [uploads, setUploads] = useState([])
  const [loadingUploads, setLoadingUploads] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/admin/config`)
      .then(r => {
        setConfig(r.data)
        setSelected(r.data.extraction_engine)
        setContexto(r.data.contexto || '')
      })
      .catch(() => setMsg({ type: 'error', text: 'Error al conectar con el backend' }))
    axios.get(`${API_BASE}/health`)
      .then(r => setServerInfo(r.data))
      .catch(() => setServerInfo({ error: 'desconectado' }))

    listUploads(50, 0).then(r => setUploads(r.data.items || [])).catch(() => {})
  }, [])

  const handleAuth = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await axios.post(`${API_BASE}/api/v1/admin/config`, { extraction_engine: selected || config?.extraction_engine }, { headers: { 'x-admin-password': password } })
      setAuthenticated(true)
      setMsg(null)
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.status === 401 ? 'Contraseña incorrecta' : 'Error de conexión' })
    }
    setSaving(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/config`, { extraction_engine: selected, contexto }, { headers: { 'x-admin-password': password } })
      setMsg({ type: 'success', text: res.data.message })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Error al guardar' })
    }
    setSaving(false)
  }

  const handleTest = async (motor) => {
    if (!testFile) return
    setTestRunning(prev => ({ ...prev, [motor]: true }))
    const start = Date.now()
    try {
      const res = await uploadImage(testFile, motor)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      setTestResults(prev => ({ ...prev, [motor]: { data: res.data, elapsed, ok: true, raw: res.data.raw_respuesta } }))
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : detail?.detail || err.message
      setTestResults(prev => ({ ...prev, [motor]: { error: msg, elapsed, ok: false } }))
    }
    setTestRunning(prev => ({ ...prev, [motor]: false }))
  }

  const handleTestAll = async () => {
    for (const m of ['gemini', 'vision', 'vision+gemini', 'vision+gemini+image']) {
      await handleTest(m)
    }
  }

  const handleTestFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setTestFile(f)
    setTestResults({})
    setOcrLines(null)
    const reader = new FileReader()
    reader.onload = (e) => setTestPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  const handleViewOcr = async () => {
    if (!testFile) return
    setLoadingOcr(true)
    setOcrLines(null)
    try {
      const form = new FormData()
      form.append('file', testFile)
      const res = await axios.post(`${API_BASE}/api/v1/admin/debug/ocr`, form)
      setOcrLines(res.data)
    } catch (err) {
      setOcrLines({ error: err.response?.data?.detail || 'Error' })
    }
    setLoadingOcr(false)
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Panel de Administración</h2>
        <div className="bg-white border rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Ingresa la contraseña" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" autoFocus />
          {msg?.type === 'error' && <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{msg.text}</div>}
          <button onClick={handleAuth} disabled={saving || !password} className="w-full py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-40 transition">{saving ? 'Verificando...' : 'Entrar'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Panel de Administración</h2>

      {/* Configuración del motor */}
      <section className="bg-white border rounded-xl p-6">
        <h3 className="font-semibold text-lg text-gray-900 mb-4">Motor de extracción global</h3>
        {config && <div className="text-sm text-gray-500 mb-4">Motor actual: <span className="font-medium text-gray-800">{config.extraction_engine}</span></div>}
        <div className="space-y-3 mb-4">
          {MOTORES.map(m => (
            <button key={m.value} type="button" onClick={() => setSelected(m.value)} className={`w-full p-4 rounded-xl border-2 text-left transition ${selected === m.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected === m.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                  {selected === m.value && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{m.label}</div>
                  <div className="text-sm text-gray-500">{m.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {msg && <div className={`mb-4 p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">CONTEXTO</label>
          <p className="text-xs text-gray-400 mb-2">Describí el contexto del listado para ayudar a Gemini: ubicación, hospital, formato, siglas, etc. Este texto se inyecta en el prompt de todos los motores que usan Gemini.</p>
          <textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={4} placeholder="Ej: La Guaira es la ciudad. CDI = Centro de Diagnóstico Integral. Los listados incluyen pacientes del Hospital Dr. José María Vargas. Las siglas MP = Medicina General, UCIA = Unidad de Cuidados Intensivos." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-40 transition">{saving ? 'Guardando...' : 'Guardar configuración'}</button>
      </section>

      {/* Debug / Test de motores */}
      <section className="bg-white border rounded-xl p-6">
        <h3 className="font-semibold text-lg text-gray-900 mb-4">Debug / Test de motores</h3>

        <div className="mb-4 p-3 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${serverInfo?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-400">Backend:</span>
            <span>{serverInfo?.status || 'desconectado'}</span>
            <span className="text-gray-500 ml-2">{serverInfo?.database}</span>
          </div>
          {serverInfo?.error && <div className="text-red-400 mt-1">{serverInfo.error}</div>}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de prueba:</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleTestFile} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {testFile && <p className="mt-1 text-sm text-gray-500">{testFile.name}</p>}
        </div>

        {testPreview && <img src={testPreview} alt="preview" className="max-h-32 rounded-lg mx-auto mb-4" />}

        {testFile && (
          <button onClick={handleTestAll} disabled={Object.values(testRunning).some(Boolean)} className="w-full py-2 mb-4 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:opacity-40 transition">
            {Object.values(testRunning).some(Boolean) ? 'Ejecutando...' : 'Testear los 3 motores'}
          </button>
        )}

        <div className="grid md:grid-cols-4 gap-3">
          {[
            { id: 'gemini', label: 'Gemini' },
            { id: 'vision', label: 'Cloud Vision' },
            { id: 'vision+gemini', label: 'Vision+Gemini' },
            { id: 'vision+gemini+image', label: 'Vis+Gem+Img' },
          ].map(m => {
            const r = testResults[m.id]
            return (
              <div key={m.id} className="bg-gray-50 border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-900">{m.label}</span>
                </div>
                <button onClick={() => handleTest(m.id)} disabled={!testFile || testRunning[m.id]} className="w-full py-1.5 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-40 transition">
                  {testRunning[m.id] ? '...' : 'Test'}
                </button>
                {r && (
                  <div className={`mt-2 p-2 rounded text-xs ${r.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{r.ok ? '✅ OK' : '❌ ERROR'}</span>
                      <span className="text-gray-400">{r.elapsed}s</span>
                    </div>
                        {r.ok ? (
                          <div className="text-green-700">
                            <div>Pacientes: <strong>{r.data?.total_pacientes}</strong></div>
                            {r.data?.advertencias?.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {r.data.advertencias.map((a, i) => <div key={i} className="text-yellow-600">⚠ {a}</div>)}
                              </div>
                            )}
                            {r.raw?.pacientes?.length > 0 && (
                              <button onClick={() => setTestExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))} className="text-blue-600 hover:underline mt-1">
                                {testExpanded[m.id] ? 'Ocultar' : `Ver ${r.raw.pacientes.length} paciente(s)`}
                              </button>
                            )}
                            {testExpanded[m.id] && (
                              <div className="mt-2 space-y-1.5">
                                {r.raw?.pacientes?.map((p, i) => (
                                  <div key={i} className="p-1.5 bg-white rounded border text-gray-700">
                                    <strong>{p.nombre?.valor || '?'}</strong>
                                    <div className="text-gray-500">{p.cedula?.valor ? `C.I: ${p.cedula.valor}` : ''} {p.edad?.valor ? `· ${p.edad.valor} años` : ''}</div>
                                    <div className="text-gray-500">{p.hospital?.valor || ''} {p.piso?.valor ? `P${p.piso.valor}` : ''} {p.habitacion?.valor ? `H${p.habitacion.valor}` : ''}</div>
                                    <div className="text-gray-400">Confianza nombre: {p.nombre?.confianza ?? '-'} · cédula: {p.cedula?.confianza ?? '-'}</div>
                                  </div>
                                ))}
                              </div>
                            )}
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

        {testFile && (
          <button onClick={handleViewOcr} disabled={loadingOcr} className="w-full py-2 mb-4 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-40 transition">
            {loadingOcr ? 'Extrayendo...' : 'Ver líneas extraídas por Cloud Vision'}
          </button>
        )}

        {ocrLines && !ocrLines.error && (
          <div className="mb-4 p-3 bg-gray-900 text-gray-300 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
            <div className="text-gray-400 mb-1">Total: {ocrLines.total_lineas} líneas</div>
            {ocrLines.lineas?.map((l, i) => <div key={i} className="hover:text-white"><span className="text-gray-500 mr-2">{i + 1}.</span>{l}</div>)}
          </div>
        )}
        {ocrLines?.error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{ocrLines.error}</div>}

        {Object.keys(testResults).filter(k => testResults[k].ok).length >= 2 && (
          <div className="mt-4 p-3 bg-gray-50 border rounded-lg">
            <h4 className="font-semibold text-sm text-gray-900 mb-2">Comparación</h4>
            <table className="w-full text-xs">
              <thead><tr className="border-b"><th className="text-left py-1 px-1 text-gray-500">Motor</th><th className="text-left py-1 px-1 text-gray-500">Tiempo</th><th className="text-left py-1 px-1 text-gray-500">Pacientes</th><th className="text-left py-1 px-1 text-gray-500">Estado</th></tr></thead>
              <tbody>
                {['gemini', 'vision', 'vision+gemini', 'vision+gemini+image'].filter(k => testResults[k]).map(k => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="py-1 px-1 font-medium">{k}</td>
                    <td className="py-1 px-1 text-gray-600">{testResults[k].elapsed}s</td>
                    <td className="py-1 px-1 text-gray-600">{testResults[k].data?.total_pacientes || '-'}</td>
                    <td className="py-1 px-1"><span className={`px-1.5 py-0.5 rounded text-xs ${testResults[k].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{testResults[k].ok ? 'OK' : 'ERROR'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lista de uploads */}
      <section className="bg-white border rounded-xl p-6">
        <h3 className="font-semibold text-lg text-gray-900 mb-4">Archivos subidos ({uploads.length})</h3>
        {loadingUploads ? (
          <div className="text-center py-4"><div className="animate-spin inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
        ) : uploads.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {uploads.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{u.total_pacientes} pacientes</div>
                  <div className="text-xs text-gray-500">
                    {u.motor} · {new Date(u.created_at).toLocaleDateString()} · {u.hospitales?.join(', ') || 'sin hospital'}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar upload con ${u.total_pacientes} pacientes?`)) return
                    setDeleting(u.id)
                    try {
                      await deleteUpload(u.id, password)
                      setUploads(prev => prev.filter(x => x.id !== u.id))
                    } catch (err) {
                      alert(err.response?.data?.detail || 'Error al eliminar')
                    }
                    setDeleting(null)
                  }}
                  disabled={deleting === u.id}
                  className="ml-3 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 disabled:opacity-40"
                >
                  {deleting === u.id ? '...' : '🗑️'}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default Admin
