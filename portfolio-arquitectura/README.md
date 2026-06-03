# 📁 Portafolio — Arquitectura de Sistemas

Portafolio académico con 4 unidades y 16 semanas, construido con HTML + Supabase + GitHub Pages.

---

## 🗂️ Estructura del proyecto

```
portfolio-arquitectura/
├── index.html          ← Portafolio público
├── admin.html          ← Panel de administración
├── css/
│   ├── style.css       ← Estilos del portafolio
│   └── admin.css       ← Estilos del panel admin
├── js/
│   ├── config.js       ← ⚠️ TUS CREDENCIALES DE SUPABASE
│   ├── app.js          ← Lógica del portafolio
│   └── admin.js        ← Lógica del panel admin
└── README.md
```

---

## ⚙️ Configuración paso a paso

### PASO 1 — Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **Start your project**
2. Crea un nuevo proyecto (elige región `South America (São Paulo)`)
3. Espera ~2 minutos a que se inicialice
4. Ve a **Settings → API** y copia:
   - `Project URL` → algo como `https://abcxyz.supabase.co`
   - `anon public` key → una clave larga

### PASO 2 — Configurar credenciales

Abre `js/config.js` y reemplaza:

```javascript
export const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co'
export const SUPABASE_KEY = 'TU_ANON_PUBLIC_KEY_AQUI'
```

### PASO 3 — Crear tablas y datos iniciales

1. En tu proyecto Supabase → **SQL Editor** → **New Query**
2. Ve al **Panel Admin** (`admin.html`) → pestaña **🌱 Datos Iniciales**
3. Copia el SQL y pégalo en el editor de Supabase
4. Haz clic en **Run**

Esto creará las 4 unidades y 16 semanas de ejemplo.

### PASO 4 — Crear Storage bucket

1. En Supabase → **Storage** → **New bucket**
2. Nombre: `portfolio-files`
3. Activar: **Public bucket** ✓
4. Crear

### PASO 5 — Política de almacenamiento (Storage RLS)

En Supabase → **Storage → Policies** → `portfolio-files` → **New policy**:

```sql
-- Permite subir archivos (INSERT)
create policy "subida publica"
on storage.objects for insert
with check (bucket_id = 'portfolio-files');

-- Permite leer archivos (SELECT)
create policy "lectura publica"
on storage.objects for select
using (bucket_id = 'portfolio-files');
```

O más simple: activa **"Allow all operations"** para el bucket en modo desarrollo.

### PASO 6 — Subir a GitHub Pages

```bash
# Inicializar repositorio
git init
git add .
git commit -m "Portfolio arquitectura de sistemas"

# Conectar con GitHub (crea el repo en github.com primero)
git branch -M main
git remote add origin https://github.com/TU_USUARIO/portfolio-arquitectura.git
git push -u origin main
```

Luego en GitHub:
1. **Settings → Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` → `/ (root)`
4. **Save**

Tu portafolio estará en: `https://TU_USUARIO.github.io/portfolio-arquitectura`

---

## 📎 Agregar recursos (archivos)

1. Abre `admin.html` en tu navegador
2. Selecciona la unidad y semana
3. Elige el tipo (PDF, imagen, Word, link, video, código)
4. Sube el archivo o pega un enlace
5. Haz clic en **Guardar recurso**

### Tipos de recursos soportados

| Tipo     | Formatos        | Descripción                     |
|----------|-----------------|---------------------------------|
| `pdf`    | .pdf            | Apuntes, exámenes, guías        |
| `imagen` | .png, .jpg      | Diagramas, capturas, mapas      |
| `word`   | .docx, .xlsx    | Documentos, tablas              |
| `link`   | URL             | Google Drive, Notion, web       |
| `video`  | URL YouTube     | Clases grabadas, tutoriales     |
| `codigo` | URL GitHub      | Repositorios, gists             |

---

## 🔧 Personalización

### Cambiar títulos de unidades/semanas

Edita los datos directamente en **Supabase → Table Editor → unidades / semanas**,
o corre un UPDATE en el SQL Editor:

```sql
update unidades set titulo = 'Mi nuevo título' where numero = 1;
update semanas set descripcion = 'Nueva descripción' where numero = 5;
```

### Cambiar colores de unidades

```sql
update unidades set color = '#ff6b6b' where numero = 1;
```

### Agregar fechas a semanas

```sql
update semanas set fecha_inicio = '2024-03-04', fecha_fin = '2024-03-08'
where numero = 1;
```

---

## 🛡️ Seguridad

- La `anon key` de Supabase es **segura de exponer** en el frontend gracias a RLS (Row Level Security)
- Las políticas creadas permiten **solo lectura pública** en las tablas
- Para producción, configura autenticación en el panel admin (Supabase Auth)

---

## 📦 Tecnologías

- **Frontend**: HTML5 + CSS3 + JavaScript (ES Modules)
- **Base de datos**: Supabase (PostgreSQL)
- **Almacenamiento**: Supabase Storage
- **Hosting**: GitHub Pages
- **Fuentes**: Syne + DM Sans (Google Fonts)
