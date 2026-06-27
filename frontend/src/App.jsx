import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Upload from './pages/Upload'
import SearchResults from './pages/SearchResults'
import PatientDetail from './pages/PatientDetail'
import RegisterPatient from './pages/RegisterPatient'
import Debug from './pages/Debug'
import Admin from './pages/Admin'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold flex items-center gap-2">
            <span>🏥</span> Emergencia Venezuela
          </Link>
          <nav className="flex gap-4 text-sm font-medium">
            <Link to="/" className="hover:text-blue-200 transition">Inicio</Link>
            <Link to="/subir" className="hover:text-blue-200 transition">Subir</Link>
            <Link to="/registrar" className="hover:text-blue-200 transition">Registrar</Link>
            <Link to="/admin" className="hover:text-blue-200 transition text-yellow-200">Admin</Link>
            <Link to="/debug" className="hover:text-blue-200 transition opacity-60">Debug</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subir" element={<Upload />} />
          <Route path="/buscar" element={<SearchResults />} />
          <Route path="/paciente/:id" element={<PatientDetail />} />
          <Route path="/registrar" element={<RegisterPatient />} />
          <Route path="/debug" element={<Debug />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      <footer className="bg-gray-100 border-t text-center py-4 text-sm text-gray-500">
        Emergencia Venezuela · Datos verificados comunitariamente · {new Date().getFullYear()}
      </footer>
    </div>
  )
}

export default App
