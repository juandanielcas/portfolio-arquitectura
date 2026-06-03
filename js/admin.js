import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_URL, SUPABASE_KEY } from './config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── STATE ───────────────────────────────────────────────────
let selectedFile = null
let uploadMode = 'archivo' // 'archivo' | 'link'
let allUnidades = []

// ─── INIT ────────────────────────────────────────────────────
async function init() {
  await cargarUnidades()
  setupTabs()
  setupForm()
  setupDropzone()
  setupSeedSQL()
  cargarRecursosAdmin()
}

// ─── CARGAR UNIDADES ─────────────────────────────────────────
async function cargarUnidades() {
  const { data, error } = await supabase
    .from('unidades')
    .select('id, numero, titulo, semanas(id, numero, titulo)')
    .order('numero')

  if (error) { showToast('Error cargando unidades: ' + error.message, 'error'); return }

  allUnidades = (data || []).map(u => ({
    ...u,
    semanas: (u.semanas || []).sort((a, b) => a.numero - b.numero)
  }))

  // Populate unidad selects
  const selects = ['sel-unidad', 'filter-unidad']
  selects.forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    const defaultOpt = el.querySelector('option[value=""]')
    el.innerHTML = ''
    if (defaultOpt) el.appendChild(defaultOpt)
    allUnidades.forEach(u => {
      const opt = document.createElement('option')
      opt.value = u.id
      opt.textContent = `Unidad ${u.numero} — ${u.titulo}`
      el.appendChild(opt)
    })
  })
}

// ─── TABS ────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active')
    })
  })
}

// ─── FORM SETUP ──────────────────────────────────────────────
function setupForm() {
  // Unidad → populate semanas
  document.getElementById('sel-unidad').addEventListener('change', (e) => {
    const unidadId = parseInt(e.target.value)
    const selSemana = document.getElementById('sel-semana')
    selSemana.innerHTML = '<option value="">— Selecciona semana —</option>'
    selSemana.disabled = !unidadId

    const unidad = allUnidades.find(u => u.id === unidadId)
    if (!unidad) return

    unidad.semanas.forEach(s => {
      const opt = document.createElement('option')
      opt.value = s.id
      opt.textContent = `Semana ${s.numero} — ${s.titulo}`
      selSemana.appendChild(opt)
    })
  })

  // Toggle archivo / link
  document.getElementById('btn-archivo').addEventListener('click', () => setMode('archivo'))
  document.getElementById('btn-link').addEventListener('click', () => setMode('link'))

  // Form submit
  document.getElementById('form-recurso').addEventListener('submit', handleSubmit)

  // Filter unidad → load resources
  document.getElementById('filter-unidad')?.addEventListener('change', cargarRecursosAdmin)
}

function setMode(mode) {
  uploadMode = mode
  document.getElementById('btn-archivo').classList.toggle('active', mode === 'archivo')
  document.getElementById('btn-link').classList.toggle('active', mode === 'link')
  document.getElementById('panel-archivo').style.display = mode === 'archivo' ? '' : 'none'
  document.getElementById('panel-link').style.display   = mode === 'link'    ? '' : 'none'
}

// ─── DROPZONE ────────────────────────────────────────────────
function setupDropzone() {
  const dz   = document.getElementById('dropzone')
  const fi   = document.getElementById('file-input')
  const prev = document.getElementById('file-preview')

  dz.addEventListener('click', () => fi.click())

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover') })
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'))
  dz.addEventListener('drop', e => {
    e.preventDefault()
    dz.classList.remove('dragover')
    handleFile(e.dataTransfer.files[0])
  })
  fi.addEventListener('change', () => handleFile(fi.files[0]))
}

function handleFile(file) {
  if (!file) return
  if (file.size > 20 * 1024 * 1024) {
    showToast('El archivo supera el límite de 20 MB', 'error'); return
  }
  selectedFile = file

  const prev = document.getElementById('file-preview')
  const icons = { pdf: '📄', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', docx: '📝', xlsx: '📊', pptx: '📊' }
  const ext   = file.name.split('.').pop().toLowerCase()
  const icon  = icons[ext] || '📎'
  const size  = file.size > 1024 * 1024
    ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
    : Math.round(file.size / 1024) + ' KB'

  prev.style.display = 'flex'
  prev.innerHTML = `
    <span class="fp-icon">${icon}</span>
    <span class="fp-name">${file.name}</span>
    <span class="fp-size">${size}</span>
    <button type="button" class="fp-clear" title="Quitar archivo">✕</button>
  `
  prev.querySelector('.fp-clear').addEventListener('click', () => {
    selectedFile = null
    prev.style.display = 'none'
    document.getElementById('file-input').value = ''
  })
}

// ─── HANDLE SUBMIT ───────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault()

  const semanaId    = parseInt(document.getElementById('sel-semana').value)
  const tipo        = document.getElementById('sel-tipo').value
  const titulo      = document.getElementById('inp-titulo').value.trim()
  const descripcion = document.getElementById('inp-descripcion').value.trim()

  if (!semanaId) { showToast('Selecciona una semana', 'error'); return }
  if (!tipo)     { showToast('Selecciona el tipo de recurso', 'error'); return }
  if (!titulo)   { showToast('Escribe un título', 'error'); return }

  setLoading(true)

  try {
    let url = ''

    if (uploadMode === 'archivo') {
      if (!selectedFile) { showToast('Selecciona un archivo', 'error'); setLoading(false); return }
      url = await uploadFile(selectedFile, semanaId)
    } else {
      url = document.getElementById('inp-url').value.trim()
      if (!url) { showToast('Pega un enlace válido', 'error'); setLoading(false); return }
    }

    const { error } = await supabase.from('recursos').insert({
      semana_id: semanaId,
      tipo,
      titulo,
      descripcion: descripcion || null,
      url
    })

    if (error) throw error

    showToast('✅ Recurso guardado correctamente', 'success')
    resetForm()
    cargarRecursosAdmin()

  } catch (err) {
    console.error(err)
    showToast('Error: ' + (err.message || 'Algo salió mal'), 'error')
  } finally {
    setLoading(false)
  }
}

// ─── UPLOAD FILE ─────────────────────────────────────────────
async function uploadFile(file, semanaId) {
  const ext      = file.name.split('.').pop().toLowerCase()
  const filename = `semana-${semanaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('portfolio-files')
    .upload(filename, file, { cacheControl: '3600', upsert: false })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('portfolio-files')
    .getPublicUrl(filename)

  return publicUrl
}

// ─── CARGAR RECURSOS (admin list) ────────────────────────────
async function cargarRecursosAdmin() {
  const container = document.getElementById('recursos-lista')
  if (!container) return

  const unidadId = document.getElementById('filter-unidad')?.value

  let query = supabase
    .from('recursos')
    .select('id, tipo, titulo, url, semana_id, semanas(numero, unidad_id, unidades(numero))')
    .order('created_at', { ascending: false })
    .limit(50)

  if (unidadId) {
    // We need to filter by unidad via semana
    const unidad = allUnidades.find(u => u.id === parseInt(unidadId))
    if (unidad) {
      const semanaIds = unidad.semanas.map(s => s.id)
      query = query.in('semana_id', semanaIds)
    }
  }

  const { data, error } = await query
  if (error) { container.innerHTML = `<p class="empty-state">Error: ${error.message}</p>`; return }

  if (!data?.length) {
    container.innerHTML = '<p class="empty-state">No hay recursos para mostrar.</p>'; return
  }

  const COLOR_MAP = { pdf:'#e05c7a', imagen:'#3ecfb2', word:'#5b8cff', link:'#f0b942', video:'#c47fff', codigo:'#55d679' }

  container.innerHTML = data.map(r => {
    const color = COLOR_MAP[r.tipo] || '#7a8199'
    const semInfo = r.semanas
      ? `U${r.semanas.unidades?.numero || '?'} · S${r.semanas.numero}`
      : ''
    return `
      <div class="recurso-admin-item" data-id="${r.id}">
        <span class="rai-type" style="color:${color};background:${color}22">${(r.tipo||'?').toUpperCase()}</span>
        <span class="rai-titulo">${r.titulo}</span>
        <span class="rai-semana">${semInfo}</span>
        <a href="${r.url}" target="_blank" style="color:var(--c-muted);font-size:13px;text-decoration:none" title="Ver recurso">↗</a>
        <button class="rai-delete" data-id="${r.id}" title="Eliminar">🗑</button>
      </div>
    `
  }).join('')

  // Delete handlers
  container.querySelectorAll('.rai-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este recurso?')) return
      const { error } = await supabase.from('recursos').delete().eq('id', btn.dataset.id)
      if (error) { showToast('Error al eliminar', 'error'); return }
      showToast('Recurso eliminado', 'info')
      btn.closest('.recurso-admin-item').remove()
    })
  })
}

// ─── SEED SQL ────────────────────────────────────────────────
function setupSeedSQL() {
  const sql = `-- ================================================
--  DATOS INICIALES — Portafolio Arquitectura de Sistemas
--  Corre este SQL en Supabase → SQL Editor
-- ================================================

-- 1. TABLAS
create table if not exists unidades (
  id          serial primary key,
  numero      int     not null,
  titulo      text    not null,
  descripcion text,
  color       text    default '#5b8cff'
);

create table if not exists semanas (
  id           serial primary key,
  unidad_id    int references unidades(id) on delete cascade,
  numero       int  not null,
  titulo       text not null,
  descripcion  text,
  fecha_inicio date,
  fecha_fin    date
);

create table if not exists recursos (
  id           serial primary key,
  semana_id    int references semanas(id) on delete cascade,
  tipo         text not null,
  titulo       text not null,
  descripcion  text,
  url          text not null,
  created_at   timestamptz default now()
);

-- 2. RLS (seguridad lectura pública)
alter table unidades enable row level security;
alter table semanas   enable row level security;
alter table recursos  enable row level security;

create policy "lectura publica" on unidades for select using (true);
create policy "lectura publica" on semanas   for select using (true);
create policy "lectura publica" on recursos  for select using (true);

-- Escritura solo autenticados (panel admin)
create policy "escritura auth" on recursos for insert with check (true);
create policy "borrado auth"   on recursos for delete using (true);

-- 3. UNIDADES
insert into unidades (numero, titulo, descripcion, color) values
  (1, 'Fundamentos de Arquitectura', 'Introducción a sistemas, capas y modelos de referencia como OSI y TCP/IP.', '#5b8cff'),
  (2, 'Diseño de Sistemas Distribuidos', 'Microservicios, comunicación entre servicios, balanceo de carga y disponibilidad.', '#3ecfb2'),
  (3, 'Bases de Datos y Persistencia', 'Modelos relacionales y no relacionales, normalización, índices y consultas avanzadas.', '#f0b942'),
  (4, 'Seguridad y Escalabilidad', 'Autenticación, cifrado, patrones de escalado vertical y horizontal, monitoreo.', '#e05c7a');

-- 4. SEMANAS — Unidad 1
insert into semanas (unidad_id, numero, titulo, descripcion, fecha_inicio, fecha_fin)
select id, 1, 'Introducción a los sistemas', 'Historia, tipos de sistemas y conceptos fundamentales.', '2024-03-04', '2024-03-08' from unidades where numero=1 union all
select id, 2, 'Modelo OSI y TCP/IP', 'Las 7 capas del modelo OSI y la pila TCP/IP en profundidad.', '2024-03-11', '2024-03-15' from unidades where numero=1 union all
select id, 3, 'Protocolos de red', 'HTTP, HTTPS, FTP, SMTP y sus características.', '2024-03-18', '2024-03-22' from unidades where numero=1 union all
select id, 4, 'Arquitectura cliente-servidor', 'Modelos de comunicación, request/response, REST.', '2024-03-25', '2024-03-29' from unidades where numero=1;

-- SEMANAS — Unidad 2
insert into semanas (unidad_id, numero, titulo, descripcion, fecha_inicio, fecha_fin)
select id, 5, 'Microservicios', 'Qué son, ventajas frente a monolitos, patrones de diseño.', '2024-04-01', '2024-04-05' from unidades where numero=2 union all
select id, 6, 'Comunicación entre servicios', 'REST, gRPC, mensajería asíncrona con colas.', '2024-04-08', '2024-04-12' from unidades where numero=2 union all
select id, 7, 'Contenedores y orquestación', 'Docker, Docker Compose, introducción a Kubernetes.', '2024-04-15', '2024-04-19' from unidades where numero=2 union all
select id, 8, 'Alta disponibilidad', 'Balanceo de carga, failover, replicación y health checks.', '2024-04-22', '2024-04-26' from unidades where numero=2;

-- SEMANAS — Unidad 3
insert into semanas (unidad_id, numero, titulo, descripcion, fecha_inicio, fecha_fin)
select id, 9,  'Modelos relacionales', 'SQL, normalización (1NF-3NF), claves y relaciones.', '2024-04-29', '2024-05-03' from unidades where numero=3 union all
select id, 10, 'Consultas avanzadas SQL', 'JOINs, subconsultas, agregaciones y optimización.', '2024-05-06', '2024-05-10' from unidades where numero=3 union all
select id, 11, 'Bases de datos NoSQL', 'MongoDB, Redis, Cassandra: cuándo y por qué usarlos.', '2024-05-13', '2024-05-17' from unidades where numero=3 union all
select id, 12, 'Transacciones y concurrencia', 'ACID, niveles de aislamiento, deadlocks y patrones.', '2024-05-20', '2024-05-24' from unidades where numero=3;

-- SEMANAS — Unidad 4
insert into semanas (unidad_id, numero, titulo, descripcion, fecha_inicio, fecha_fin)
select id, 13, 'Autenticación y autorización', 'JWT, OAuth 2.0, RBAC y sesiones seguras.', '2024-05-27', '2024-05-31' from unidades where numero=4 union all
select id, 14, 'Cifrado y seguridad en tránsito', 'TLS/SSL, cifrado simétrico y asimétrico, HTTPS.', '2024-06-03', '2024-06-07' from unidades where numero=4 union all
select id, 15, 'Patrones de escalabilidad', 'Escalado horizontal, caché, CDN y arquitectura serverless.', '2024-06-10', '2024-06-14' from unidades where numero=4 union all
select id, 16, 'Monitoreo y observabilidad', 'Logs, métricas, trazas distribuidas, alertas.', '2024-06-17', '2024-06-21' from unidades where numero=4;`

  const pre = document.getElementById('sql-seed')
  if (pre) pre.textContent = sql

  document.getElementById('btn-copy-sql')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(sql)
    const btn = document.getElementById('btn-copy-sql')
    btn.textContent = '✓ Copiado'
    btn.classList.add('copied')
    setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied') }, 2000)
  })
}

// ─── HELPERS ─────────────────────────────────────────────────
function resetForm() {
  document.getElementById('form-recurso').reset()
  document.getElementById('sel-semana').disabled = true
  document.getElementById('sel-semana').innerHTML = '<option value="">— Primero elige unidad —</option>'
  selectedFile = null
  document.getElementById('file-preview').style.display = 'none'
  document.getElementById('file-input').value = ''
  document.getElementById('inp-url').value = ''
  setMode('archivo')
}

function setLoading(loading) {
  const btn     = document.getElementById('btn-submit')
  const text    = document.getElementById('btn-text')
  const spinner = document.getElementById('btn-spinner')
  btn.disabled = loading
  text.style.display    = loading ? 'none' : ''
  spinner.style.display = loading ? '' : 'none'
}

let toastTimer = null
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast')
  toast.textContent = msg
  toast.className = `toast show ${type}`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.classList.remove('show') }, 3500)
}

// ─── KICK OFF ────────────────────────────────────────────────
init()
