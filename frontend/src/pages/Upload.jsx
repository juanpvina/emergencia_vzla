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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Subir Datos</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setTab('imagen'); setFile(null); setPreview(null); setExcelPreview(null); setResult(null); setError(null) }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            tab === 'imagen' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📸 Imagen (Foto de lista)
        </button>
        <button
          onClick={() => { setTab('excel'); setFile(null); setPreview(null); setExcelPreview(null); setResult(null); setError(null) }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            tab === 'excel' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📊 Archivo Excel
        </button>
      </div>

      {tab === 'imagen' && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">Motor de extracción:</label>
          <div className="flex gap-2">
            {[
              { value: 'gemini', label: '🧠 Gemini', desc: 'IA (requiere API Key)' },
              { value: 'vision', label: '👁️ Cloud Vision', desc: 'OCR + parser (gratis)' },
              { value: 'vision+gemini', label: '👁️+🧠 Vision+Gemini', desc: 'OCR + IA estructura' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMotor(opt.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs text-center transition border ${
                  motor === opt.value
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className={motor === opt.value ? 'text-blue-100' : 'text-gray-400'}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'excel' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-800">
            ¿No tienes el formato? Descarga la plantilla oficial.
          </span>
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-blue-700 text-white text-sm rounded hover:bg-blue-800 transition"
          >
            📥 Descargar Plantilla
          </button>
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
              {tab === 'imagen' ? 'Extraer Datos con IA' : 'Cargar Pacientes'}
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
                {tab === 'imagen' ? `Analizando con ${motor === 'gemini' ? 'Gemini AI' : motor === 'vision' ? 'Cloud Vision' : 'Vision + Gemini'}...` : 'Procesando archivo...'} {progress}%
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
            Pacientes encontrados: <strong>{result.total_pacientes}</strong>
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
