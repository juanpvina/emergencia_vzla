import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPatient, getPatientImageUrl, getVerifications, submitVerification } from '../services/api'

function generateFingerprint() {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    navigator.platform || '',
  ].join('|')
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash |= 0
  }
  return 'fp_' + Math.abs(hash).toString(36).slice(0, 16)
}

function PatientDetail() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [verifications, setVerifications] = useState(null)
  const [loading, setLoading] = useState(true)
  const [imageLoading, setImageLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [voteType, setVoteType] = useState('confirmar')
  const [comment, setComment] = useState('')
  const [voteError, setVoteError] = useState(null)
  const [voteSuccess, setVoteSuccess] = useState(null)

  const fingerprint = generateFingerprint()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPatient(id),
      getVerifications(id),
    ])
      .then(([pRes, vRes]) => {
        setPatient(pRes.data)
        setVerifications(vRes.data)
      })
      .catch(() => setPatient(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleVote = async () => {
    setVoting(true)
    setVoteError(null)
    setVoteSuccess(null)
    try {
      const payload = {
        tipo: voteType,
        verificador_id: fingerprint,
        comentario: voteType === 'reportar_error' ? comment : null,
      }
      const res = await submitVerification(id, payload)
      setVerifications({ stats: res.data, votos: [...(verifications?.votos || []), { tipo: voteType, comentario: comment }] })
      setVoteSuccess('¡Gracias! Tu verificación fue registrada.')
      setShowForm(false)
      setComment('')
    } catch (err) {
      setVoteError(err.response?.data?.detail || 'Error al enviar verificación')
    }
    setVoting(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-gray-600">Paciente no encontrado</p>
        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">Volver al inicio</Link>
      </div>
    )
  }

  const stats = verifications?.stats || patient

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">← Volver</Link>

      <div className="bg-white border rounded-xl p-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-gray-100 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
              {imageLoading && (
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              )}
              <img
                src={getPatientImageUrl(id)}
                alt={`Listado de ${patient.nombre}`}
                className="w-full h-auto"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
                style={{ display: imageLoading ? 'none' : 'block' }}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{patient.nombre}</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              <StatusBadge status={stats.status_verificacion || patient.status_verificacion} />
              {patient.confianza_global != null && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  Confianza IA: {(patient.confianza_global * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {patient.cedula && (
                <>
                  <dt className="text-gray-500">Cédula</dt>
                  <dd className="font-medium text-gray-900">{patient.cedula}</dd>
                </>
              )}
              {patient.edad != null && (
                <>
                  <dt className="text-gray-500">Edad</dt>
                  <dd className="font-medium text-gray-900">{patient.edad} años</dd>
                </>
              )}
              {patient.hospital && (
                <>
                  <dt className="text-gray-500">Hospital</dt>
                  <dd className="font-medium text-gray-900">{patient.hospital}</dd>
                </>
              )}
              {patient.piso && (
                <>
                  <dt className="text-gray-500">Piso</dt>
                  <dd className="font-medium text-gray-900">{patient.piso}</dd>
                </>
              )}
              {patient.habitacion && (
                <>
                  <dt className="text-gray-500">Habitación</dt>
                  <dd className="font-medium text-gray-900">{patient.habitacion}</dd>
                </>
              )}
              {patient.estado_salud && (
                <>
                  <dt className="text-gray-500">Estado de salud</dt>
                  <dd className="font-medium text-gray-900">{patient.estado_salud}</dd>
                </>
              )}
              {patient.contacto && (
                <>
                  <dt className="text-gray-500">Contacto</dt>
                  <dd className="font-medium text-gray-900">{patient.contacto}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Verificación comunitaria */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold text-lg text-gray-900 mb-3">Verificación Comunitaria</h3>

          <div className="flex gap-6 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.total_confirmaciones || 0}</div>
              <div className="text-xs text-gray-500">Confirmaciones</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.total_reportes || 0}</div>
              <div className="text-xs text-gray-500">Reportes de error</div>
            </div>
          </div>

          {voteSuccess ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {voteSuccess}
            </div>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition"
            >
              Verificar Datos
            </button>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">¿Son correctos los datos de este paciente?</p>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setVoteType('confirmar')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    voteType === 'confirmar' ? 'bg-green-600 text-white' : 'bg-white border text-gray-700'
                  }`}
                >
                  ✅ Confirmar
                </button>
                <button
                  onClick={() => setVoteType('reportar_error')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    voteType === 'reportar_error' ? 'bg-red-600 text-white' : 'bg-white border text-gray-700'
                  }`}
                >
                  ❌ Reportar Error
                </button>
              </div>

              {voteType === 'reportar_error' && (
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Describe el error encontrado..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              )}

              {voteError && (
                <p className="text-red-600 text-sm mb-3">{voteError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleVote}
                  disabled={voting}
                  className="px-4 py-1.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition"
                >
                  {voting ? 'Enviando...' : 'Enviar Voto'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setVoteError(null) }}
                  className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition"
                >
                  Cancelar
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-2">
                Tu voto es anónimo. ID de dispositivo: {fingerprint.slice(0, 10)}...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    no_verificado: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Sin verificar' },
    parcial: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Parcial' },
    verificado: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verificado' },
    error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error reportado' },
  }
  const s = map[status] || map.no_verificado
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export default PatientDetail
