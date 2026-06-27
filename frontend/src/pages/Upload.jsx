import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { uploadImage, uploadExcel, downloadExcelTemplate } from '../services/api'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Upload() {
  const [tab, setTab] = useState('imagen')
  const [motor, setMotor] = useState('gemini')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [excelPreview, setExcelPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showTips, setShowTips] = useState(false)

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/admin/config`)
      .then(r => setMotor(r.data.extraction_engine))
      .catch(() => {})
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    setError(null)
    setResult(null)
    const f = acceptedFiles[0]
    if (!f) return

    setFile(f)

    if (tab === 'imagen') {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(f)
      setExcelPreview(null)
    } else {
      setPreview(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
          setExcelPreview(data.slice(0, 6))
        } catch {
          setExcelPreview(null)
        }
      }
      reader.readAsArrayBuffer(f)
    }
  }, [tab])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: tab === 'imagen'
      ? { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }
      : { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  })

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError(null)
    setResult(null)
    try {
      const uploadFn = tab === 'imagen' ? (f, cb) => uploadImage(f, motor, cb) : uploadExcel
      const res = await uploadFn(file, setProgress)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
    setUploading(false)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadExcelTemplate()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_pacientes.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError('Error al descargar la plantilla')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Subir datos de pacientes</h2>
      <p className="text-gray-500 mb-6">
        Sube una lista de pacientes para que otros puedan buscarlos.
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setTab('imagen'); setFile(null); setPreview(null); setExcelPreview(null); setResult(null); setError(null) }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            tab === 'imagen' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Foto de una lista
        </button>
        <button
          onClick={() => { setTab('excel'); setFile(null); setPreview(null); setExcelPreview(null); setResult(null); setError(null) }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            tab === 'excel' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Archivo Excel
        </button>
      </div>

      {tab === 'imagen' && (
        <div className="mb-6 space-y-3">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">Toma una foto clara de la lista de pacientes</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Coloca la hoja sobre una superficie plana y sin sombras</li>
              <li>Aleja bien la cámara para que quepa toda la lista</li>
              <li>Procura buena luz y que el texto se vea nítido</li>
              <li>Evita fotos inclinadas o borrosas</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <p className="font-medium mb-1">¿Qué pasa después?</p>
            <p>El sistema lee automáticamente los nombres, cédulas y datos de cada persona de la lista y los guarda para que cualquiera pueda buscarlos desde la página principal.</p>
          </div>
        </div>
      )}

      {tab === 'excel' && (
        <div className="mb-6 space-y-3">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <p className="font-medium mb-1">Usa nuestra plantilla para llenar los datos</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Descarga la plantilla, completa los datos y súbela de vuelta</li>
              <li>Cada fila es un paciente distinto</li>
              <li>Las columnas con <strong>*</strong> son obligatorias</li>
              <li>Si no tienes el dato de una columna, déjala vacía</li>
            </ul>
          </div>

          <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700 font-medium">Descargar plantilla Excel</span>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition font-medium"
            >
              Descargar
            </button>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-lg text-blue-600 font-medium">Suelta el archivo aquí...</p>
        ) : (
          <div>
            <div className="text-4xl mb-3">{tab === 'imagen' ? '📸' : '📊'}</div>
            <p className="text-gray-600 mb-1">
              Arrastra y suelta un archivo aquí, o haz clic para seleccionar
            </p>
            <p className="text-sm text-gray-400">
              {tab === 'imagen' ? 'JPG, PNG, WEBP · Máx 20MB' : 'Solo archivos .xlsx'}
            </p>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-4 p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-medium text-gray-800">{file.name}</span>
              <span className="text-sm text-gray-400 ml-2">
                ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </div>
            <button
              onClick={() => { setFile(null); setPreview(null); setExcelPreview(null); setResult(null) }}
              className="text-red-500 text-sm hover:underline"
            >
              Quitar
            </button>
          </div>

          {preview && (
            <img src={preview} alt="Preview" className="max-h-64 rounded-lg mx-auto mb-3" />
          )}

          {excelPreview && excelPreview.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {excelPreview[0].map((h, i) => (
                      <th key={i} className="border px-2 py-1 text-left font-medium text-gray-700">
                        {h || '(vacío)'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelPreview.slice(1).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, j) => (
                        <td key={j} className="border px-2 py-1 text-gray-600">
                          {cell ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelPreview.length >= 6 && (
                <p className="text-xs text-gray-400 mt-1">Vista previa: primeras {excelPreview.length - 1} filas</p>
              )}
            </div>
          )}

          {!uploading && !result && (
            <button
              onClick={handleUpload}
              className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition"
            >
              {tab === 'imagen' ? 'Extraer datos de la foto' : 'Cargar pacientes'}
            </button>
          )}

          {uploading && (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Procesando... {progress}%
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Procesamiento completado</h3>
          <p className="text-green-700">
            Pacientes registrados: <strong>{result.total_pacientes}</strong>
          </p>
          <p className="text-sm text-green-600 mt-1">
            Ya pueden buscar a estas personas desde la página principal.
          </p>
          {result.advertencias?.length > 0 && (
            <div className="mt-2">
              <p className="text-yellow-700 font-medium text-sm">Advertencias:</p>
              <ul className="list-disc list-inside text-sm text-yellow-600">
                {result.advertencias.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          <button
            onClick={() => { setFile(null); setPreview(null); setExcelPreview(null); setResult(null) }}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
          >
            Subir otro archivo
          </button>
        </div>
      )}
    </div>
  )
}

export default Upload
