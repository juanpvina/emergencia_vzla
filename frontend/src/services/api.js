import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 60000,
});

export async function uploadImage(file, motor = 'gemini', onProgress) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/extraccion/upload', form, {
    params: { motor },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}

export async function uploadExcel(file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/extraccion/upload-excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}

export async function searchPatients({ cedula, nombre, q, limit = 20, offset = 0 }) {
  const params = { limit, offset };
  if (cedula) params.cedula = cedula;
  else if (nombre) params.nombre = nombre;
  else if (q) params.q = q;
  return api.get('/busqueda', { params });
}

export async function getPatient(id) {
  return api.get(`/pacientes/${id}`);
}

export async function createPatient(data) {
  return api.post('/pacientes', data);
}

export async function getPatientImageUrl(id) {
  return `${API_BASE}/api/v1/pacientes/${id}/imagen`;
}

export async function getPatientPhotoUrl(id) {
  return `${API_BASE}/api/v1/pacientes/${id}/foto-paciente`;
}

export async function getVerifications(patientId) {
  return api.get(`/verificaciones/${patientId}`);
}

export async function submitVerification(patientId, data) {
  return api.post(`/verificaciones/${patientId}`, data);
}

export async function downloadExcelTemplate() {
  return api.get('/extraccion/plantilla-excel', { responseType: 'blob' });
}

export async function listPatients(limit = 20, offset = 0) {
  return api.get('/pacientes', { params: { limit, offset } });
}

export async function uploadPatientPhoto(id, file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/pacientes/${id}/foto`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}

export async function updatePatient(id, data) {
  return api.put(`/pacientes/${id}`, data);
}

export async function deletePatient(id) {
  return api.delete(`/pacientes/${id}`);
}

export async function listUploads(limit = 20, offset = 0) {
  return api.get('/uploads', { params: { limit, offset } });
}

export async function getUploadDetail(id) {
  return api.get(`/uploads/${id}`);
}
