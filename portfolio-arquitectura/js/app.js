import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_URL, SUPABASE_KEY } from './config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const UNIT_COLORS = ['#5b8cff', '#3ecfb2', '#f0b942', '#e05c7a']

const TIPO_LABELS = {
  pdf:    'PDF',
  imagen: 'IMG',
  word:   'DOC',
  link:   'LINK',
  video:  'VIDEO',
  codigo: 'CODE',
}
const TIPO_ICONS = {
  pdf:    '📄',
  imagen: '🖼️',
  word:   '📝',
  link:   '🔗',
  video:  '🎥',
  codigo: '💻',
}

// ─── INIT ───────────────────────────────────────────────────
async function init() {
  // Validate config
  if (SUPABASE_URL.includes('TU_PROYECTO') || SUPABASE_KEY.includes('TU_ANON')) {
    document.getElementById('loading').style.display = 'none'
    document.getElementById('error-state').style.display = 'block'
    return
  }

  try {
    const { data: unidades, error } = await supabase
      .from('unidades')
      .select(`
        id, numero, titulo, descripcion, color,
        semanas (
          id, numero, titulo, descripcion, fecha_inicio, fecha_fin, unidad_id,
          recursos ( id, tipo, titulo, descripcion, url, created_at )
        )
      `)
      .order('numero', { ascending: true })

    if (error) throw error

    // Sort semanas inside each unidad
    unidades.forEach(u => {
      u.semanas = (u.semanas || []).sort((a, b) => a.numero - b.numero)
    })

    renderPortfolio(unidades)
    updateStats(unidades)

  } catch (err) {
    console.error('Error cargando portafolio:', err)
    document.getElementById('loading').style.display = 'none'
    document.getElementById('error-state').style.display = 'block'
  }
}

// ─── RENDER PORTFOLIO ────────────────────────────────────────
function renderPortfolio(unidades) {
  const container = document.getElementById('portfolio')
  container.innerHTML = ''

  unidades.forEach((unidad, idx) => {
    const color = unidad.color || UNIT_COLORS[idx % UNIT_COLORS.length]
    const totalRecursos = (unidad.semanas || []).reduce(
      (acc, s) => acc + (s.recursos || []).length, 0
    )
    const semanasConRecursos = (unidad.semanas || []).filter(
      s => (s.recursos || []).length > 0
    ).length
    const progreso = unidad.semanas?.length
      ? Math.round((semanasConRecursos / unidad.semanas.length) * 100)
      : 0

    const section = document.createElement('section')
    section.className = 'unidad'
    section.id = `unidad-${unidad.numero}`
    section.style.setProperty('--u-color', color)

    section.innerHTML = `
      <div class="unidad-header">
        <div class="unidad-accent-bar"></div>
        <div class="unidad-meta">
          <div class="unidad-badge">Unidad ${unidad.numero}</div>
          <h2 class="unidad-titulo">${unidad.titulo}</h2>
          ${unidad.descripcion ? `<p class="unidad-desc">${unidad.descripcion}</p>` : ''}
        </div>
        <div class="unidad-progress">
          <span class="up-label">${progreso}% completado · ${totalRecursos} recursos</span>
          <div class="up-bar">
            <div class="up-bar-fill" style="width:${progreso}%"></div>
          </div>
        </div>
      </div>
      <div class="semanas-grid" id="semanas-u${unidad.numero}">
        ${(unidad.semanas || []).map(s => renderSemana(s, color)).join('')}
      </div>
    `

    container.appendChild(section)
  })
}

// ─── RENDER SEMANA ───────────────────────────────────────────
function renderSemana(semana, color) {
  const recursos = semana.recursos || []
  const fechaStr = semana.fecha_inicio && semana.fecha_fin
    ? `${formatDate(semana.fecha_inicio)} – ${formatDate(semana.fecha_fin)}`
    : semana.fecha_inicio ? formatDate(semana.fecha_inicio) : ''

  return `
    <div class="semana-card" style="--u-color:${color}">
      <div class="semana-head">
        <span class="semana-num">Semana ${semana.numero}</span>
        ${fechaStr ? `<span class="semana-fechas">${fechaStr}</span>` : ''}
      </div>
      <h3 class="semana-titulo">${semana.titulo}</h3>
      ${semana.descripcion ? `<p class="semana-desc">${semana.descripcion}</p>` : ''}
      <div class="recursos-lista">
        ${recursos.length
          ? recursos.map(r => renderRecurso(r)).join('')
          : '<p class="semana-empty">Sin recursos aún</p>'
        }
      </div>
    </div>
  `
}

// ─── RENDER RECURSO ──────────────────────────────────────────
function renderRecurso(recurso) {
  const tipo = recurso.tipo || 'link'
  const label = TIPO_LABELS[tipo] || tipo.toUpperCase()
  const icon = TIPO_ICONS[tipo] || '📎'

  return `
    <a href="${recurso.url}" target="_blank" rel="noopener" class="recurso-item ${tipo}" title="${recurso.descripcion || recurso.titulo}">
      <span class="recurso-dot"></span>
      <span class="recurso-type">${label}</span>
      <span class="recurso-titulo-text">${recurso.titulo}</span>
      <span class="recurso-arrow">↗</span>
    </a>
  `
}

// ─── UPDATE STATS ────────────────────────────────────────────
function updateStats(unidades) {
  const totalRecursos = unidades.reduce((acc, u) =>
    acc + (u.semanas || []).reduce((a, s) => a + (s.recursos || []).length, 0), 0
  )
  document.getElementById('total-recursos').textContent = totalRecursos

  // Progress (semanas con al menos 1 recurso / 16 semanas)
  const totalSemanas = unidades.reduce((a, u) => a + (u.semanas || []).length, 0)
  const completadas = unidades.reduce((acc, u) =>
    acc + (u.semanas || []).filter(s => (s.recursos || []).length > 0).length, 0
  )
  const pct = totalSemanas ? Math.round((completadas / totalSemanas) * 100) : 0

  setTimeout(() => {
    document.getElementById('progress-fill').style.width = pct + '%'
    document.getElementById('progress-pct').textContent = pct + '%'
  }, 300)
}

// ─── UTILS ───────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}

// ─── KICK OFF ────────────────────────────────────────────────
init()
