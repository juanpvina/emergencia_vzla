import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPatient } from '../services/api'

function RegisterPatient() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '', cedula: '', hospital: '', piso: '',
    habitacion: '', edad: '', estado_salud: '', contacto: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    const payload = {
      nombre: form.nombre.trim(),
      cedula: form.cedula.trim() || null,
      hospital: form.hospital.trim() || null,
      piso: form.piso.trim() || null,
      habitacion: form.habitacion.trim() || null,
      edad: form.edad ? parseInt(form.edad) : null,
      estado_salud: form.estado_salud.trim() || null,
      contacto: form.contacto.trim() || null,
    }

    setLoading(true)
    setError(null)
    try {
      const res = await createPatient(payload)
      setSuccess(res.data)
      setForm({ nombre: '', cedula: '', hospital: '', piso: '', habitacion: '', edad: '', estado_salud: '', contacto: '' })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrar paciente')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Registrar Paciente / Desaparecido</h2>
      <p className="text-gray-500 mb-6">Ingresa manualmente los datos de una persona.</p>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-800">{success.message}</p>
          <button
            onClick={() => navigate(`/paciente/${success.data.id}`)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Ver paciente registrado →
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: María José Pérez Rodríguez"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
            <input
              name="cedula"
              value={form.cedula}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
            <input
              name="edad"
              type="number"
              value={form.edad}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="45"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hospital</label>
          <input
            name="hospital"
            value={form.hospital}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Hospital Vargas"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
            <input
              name="piso"
              value={form.piso}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Habitación</label>
            <input
              name="habitacion"
              value={form.habitacion}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="302"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado de Salud</label>
          <select
            name="estado_salud"
            value={form.estado_salud}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            <option value="Estable">Estable</option>
            <option value="Grave">Grave</option>
            <option value="Crítico">Crítico</option>
            <option value="Reservado">Reservado</option>
            <option value="Mejoría">Mejoría</option>
            <option value="Alta médica">Alta médica</option>
            <option value="Fallecido">Fallecido</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contacto (teléfono)</label>
          <input
            name="contacto"
            value={form.contacto}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+584121234567"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
        >
          {loading ? 'Registrando...' : 'Registrar Paciente'}
        </button>
      </form>
    </div>
  )
}

export default RegisterPatient
