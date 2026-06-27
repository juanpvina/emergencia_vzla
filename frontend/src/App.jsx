import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Upload from './pages/Upload'
import SearchResults from './pages/SearchResults'
import PatientDetail from './pages/PatientDetail'
import Archivos from './pages/Archivos'
import Admin from './pages/Admin'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-header text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold flex items-center gap-2">
            <span>🏥</span> Emergencia Venezuela
          </Link>
          <nav className="flex gap-4 text-sm font-medium">
            <Link to="/" className="hover:text-blue-200 transition">Inicio</Link>
            <Link to="/subir" className="hover:text-blue-200 transition">Subir</Link>
            <Link to="/admin" className="hover:text-blue-200 transition text-yellow-200">Admin</Link>
            <Link to="/archivos" className="hover:text-blue-200 transition opacity-70">Archivos</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 animate-fade-in">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subir" element={<Upload />} />
          <Route path="/buscar" element={<SearchResults />} />
          <Route path="/paciente/:id" element={<PatientDetail />} />
          <Route path="/archivos" element={<Archivos />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      <footer className="bg-gray-100 border-t text-center py-4 text-sm text-gray-500">
        Emergencia Venezuela · Datos verificados comunitariamente · by Cognitive.latam · {new Date().getFullYear()}
      </footer>
    </div>
  )
}

export default App
