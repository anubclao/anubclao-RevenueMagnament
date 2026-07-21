# Deploy a Hostinger — Hotel Bora Bora Revenue Manager

> Generado: 2026-07-20
> Estado: app lista para deploy, datos en `docs/seed_data.sql` (5.4 MB, 28,118 filas).

---

## ⚠️ El problema que hay que resolver primero

**Hostinger Premium (planes Web App Node.js) NO soporta Python/FastAPI.** El plan A real es:

- ❌ FastAPI + uvicorn → no corre en Hostinger Node.js
- ✅ Next.js fullstack (frontend + API routes) → sí corre

Tienes **3 caminos**:

| Plan | Qué hacer | Tiempo | Costo |
|---|---|---|---|
| **A. Migrar backend a Next.js API Routes** | Reescribir 6 routers FastAPI → TypeScript en `frontend/app/api/*` | ~4-6 h | $0 (1 solo host) |
| **B. Split deploy** | Next.js en Hostinger + FastAPI en Railway/Render | ~1 h setup | ~$5-10/mes extra |
| **C. Hospedaje Python externo** | Hostinger sólo para archivos estáticos + PythonAnywhere/Railway | ~2 h | similar a B |

**Mi recomendación: Plan A.** Es 1 solo deploy, sin costos extra, y la app es lo bastante pequeña para que la migración sea directa (6 endpoints, sin lógica pesada — pandas se reemplaza por `exceljs` para la carga, y las predicciones son cálculos puros).

Los pasos de abajo cubren los **3 planes** para que elijas.

---

## 0. Lo que ya tienes listo

- ✅ `docs/seed_data.sql` — 5.4 MB, 28,118 filas (canales + pickup + STLY + ventas + log)
- ✅ `docs/init.sql` — DDL limpio para MySQL utf8mb4
- ✅ `frontend/` — Next.js 15 + TypeScript + Recharts, typecheck OK
- ✅ `backend/` — FastAPI (corre en local, no se sube a Hostinger)
- ✅ Excel cargado y validado en local con 28,822 filas

---

## 1. Crear la base de datos en Hostinger

### 1.1 Desde hPanel

1. Entra a **hPanel → Bases de datos MySQL**.
2. Click **Crear nueva base de datos**:
   - Nombre: `bora_bora_rm` (Hostinger le pone prefijo automático, algo como `u123456_bora_bora_rm`)
   - Usuario: autogenerado o propio
   - Contraseña: **guárdala**, la necesitas para el `.env`
   - Charset: **utf8mb4** (CRÍTICO, los tildes de "Teléfono" y "Correo Electrónico" se rompen con latin1)
3. Apunta los datos:
   - `DB_HOST` (ej: `srv1234.hstgr.io`)
   - `DB_USER` (ej: `u123456_admin`)
   - `DB_NAME` (ej: `u123456_bora_bora_rm`)
   - `DB_PASS` (la que pusiste)

### 1.2 Cargar el esquema + datos

1. **hPanel → Bases de datos → phpMyAdmin** (entra con las credenciales de arriba).
2. Click en tu DB en el panel izquierdo.
3. Tab **Importar**:
   - Click **Elegir archivo** → sube `docs/seed_data.sql`
   - Formato: **SQL**
   - Modo: **SQL** (no "SQL compatibility")
   - **NO marques** "Allow interrupt" (es archivo grande, déjalo correr)
   - Click **Continuar**.
4. Espera 30-90 segundos. Debería decir "Importación exitosa, X consultas ejecutadas".
5. Verifica en tab **Estructura** que veas 5 tablas: `channels`, `pickup_weekly`, `stly_sales`, `channel_sales_month`, `ingest_log`.

### 1.3 Si phpMyAdmin se queda corto con 5.4 MB

Si la subida por web falla (timeout o límite de 2 MB en algunos planes):

1. Entra por **SSH** (hPanel → Avanzado → SSH Access).
2. Sube el archivo con scp o File Manager.
3. Corre directamente:

```bash
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < ~/seed_data.sql
```

---

## 2. Plan A — Migrar a Next.js API Routes (RECOMENDADO)

### 2.1 Estructura nueva del frontend

```
frontend/
  app/
    api/
      health/route.ts                ← health check
      dashboard/
        metrics/route.ts             ← KPIs anuales
        charts/route.ts              ← datos para 4 gráficos
      pickup/
        route.ts                    ← GET/POST pickup
      stly/route.ts                 ← GET STLY
      channels/route.ts             ← GET catálogo
      channel-sales/route.ts        ← GET Venta por canal
      predictions/route.ts          ← GET predicciones
      upload-excel/route.ts         ← POST Excel
      ingest-log/route.ts           ← GET log de cargas
    dashboard/page.tsx              ← (ya existe)
    pickup/page.tsx                 ← (ya existe)
    stly/page.tsx                   ← (ya existe)
    channels-sales/page.tsx         ← (ya existe)
    predictions/page.tsx            ← (ya existe)
  lib/
    db.ts                           ← pool MySQL con mysql2
    kpi.ts                          ← cálculos (port de kpi_service.py)
    predictions.ts                  ← predicciones (port)
    excel.ts                        ← exceljs para uploads
```

### 2.2 Migración endpoint por endpoint

Cada router FastAPI se traduce así:

| FastAPI (Python) | Next.js (TypeScript) |
|---|---|
| `@router.get("/dashboard/metrics")` | `export async function GET(req)` |
| `await session.execute(...)` | `await pool.query(...)` |
| `Numeric(15,2)` | `DECIMAL(15,2)` (mysql2 lo retorna como string, lo parseamos) |
| `pd.read_excel()` | `exceljs` para parsear XLSX |
| `commit()` | automático en mysql2/promise |

**Orden sugerido de migración** (de menos a más complejo):

1. `/api/health` — solo retornar `{ status: "ok" }` (10 min)
2. `/api/dashboard/metrics` — port directo del SQL de kpi_service.py (30 min)
3. `/api/dashboard/charts` — los 4 queries de series (45 min)
4. `/api/pickup`, `/api/stly`, `/api/channels` — endpoints simples con filtros (30 min c/u)
5. `/api/predictions` — port de predictions_service.py (30 min, son puros cálculos)
6. `/api/upload-excel` — el más complejo, usa exceljs (1.5 h)

### 2.3 Dependencias nuevas a instalar

```bash
cd frontend
npm install mysql2 exceljs
npm uninstall @types/pdftoppm  # no se usa
```

### 2.4 Archivo `.env.local` (frontend) para producción

Crea `frontend/.env.production`:

```env
DB_HOST=srv1234.hstgr.io
DB_USER=u123456_admin
DB_PASS=tu_password_aqui
DB_NAME=u123456_bora_bora_rm
```

Y `frontend/.env` (para dev local):

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=
DB_NAME=bora_bora_rm
```

**Nota**: estos archivos NUNCA se commitean. Sube el `.env.production` por SSH o File Manager directo a Hostinger.

### 2.5 Subir el código a Hostinger

#### Opción A — Git (recomendado)

1. Sube el repo a GitHub/GitLab (sólo `frontend/` y `docs/`).
2. hPanel → Avanzado → **Git** → Conectar repo.
3. Branch: `main` o `master`.

#### Opción B — FTP manual

1. hPanel → **Administrador de archivos**.
2. Sube **sólo** la carpeta `frontend/` a `public_html/` (o a un subdir si quieres coexistir con otros sitios).
3. Sube `docs/seed_data.sql` por separado, ya lo cargaste en DB.

### 2.6 Configurar la app Node.js en Hostinger

1. hPanel → Avanzado → **Node.js** → **Crear aplicación**:
   - Versión: **20.x** o **22.x** (Next 15 requiere Node ≥ 18.18)
   - Modo: **Production**
   - Entry point: `frontend/server.js` (ver abajo)
   - Root: `public_html/frontend`
2. En **Variables de entorno** agrega:
   - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` (los mismos del paso 1.1)
   - `NODE_ENV=production`
3. Click **Guardar y reimplementar** (botón morado — el gris no toma env vars).

### 2.7 Crear el entry point para Next.js standalone

En `frontend/server.js`:

```js
const { createServer } = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
```

Y en `frontend/package.json` agrega el script:

```json
{
  "scripts": {
    "start:hostinger": "NODE_ENV=production node server.js"
  }
}
```

### 2.8 Habilitar rewrite en `.htaccess`

Crea `frontend/.htaccess` (Hostinger Apache lo necesita para que las rutas Next.js funcionen):

```apache
RewriteEngine On
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

O usa la opción de Hostinger: **Node.js app con proxy inverso automático** (lo configura hPanel al crear la app).

---

## 3. Plan B — Split deploy (FastAPI en Railway)

Si decides mantener FastAPI:

### 3.1 Backend en Railway

1. Crea cuenta en [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub repo** (apunta a `backend/`).
3. Variables de entorno (mismas que local + tu MySQL de Hostinger):
   ```
   DATABASE_URL=mysql+asyncmy://u123456_admin:PASS@srv1234.hstgr.io:3306/u123456_bora_bora_rm
   APP_CORS_ORIGINS=https://tu-dominio.com
   APP_ENV=production
   ```
4. Railway detecta `requirements.txt` y hace deploy.
5. Anota la URL (ej: `https://bora-api.up.railway.app`).

### 3.2 Frontend en Hostinger

1. Crea app Node.js en Hostinger (igual que Plan A, pasos 2.5-2.7).
2. El frontend apunta a la API de Railway vía `NEXT_PUBLIC_API_BASE=https://bora-api.up.railway.app`.

### 3.3 Costo

- Hostinger: tu plan actual
- Railway: free tier se acaba rápido con DB. Hobby plan ~$5/mes.

---

## 4. Plan C — Solo frontend + PythonAnywhere

1. Sube el frontend Next.js estático a Hostinger.
2. Sube FastAPI a PythonAnywhere (gratis para empezar, $5/mes con DB).
3. Conecta via CORS.

No lo recomiendo a menos que ya tengas cuenta en PythonAnywhere.

---

## 5. Verificación post-deploy

Después del primer deploy, verifica:

```bash
# 1. Health check
curl https://tu-dominio.com/api/health
# debe retornar: {"status":"ok",...}

# 2. Métricas (debería dar 24.36B COP en ingresos año 2026)
curl https://tu-dominio.com/api/dashboard/metrics?year=2026

# 3. STLY (debe retornar array con 27K+ registros)
curl https://tu-dominio.com/api/stly | head -c 500
```

En el navegador:

1. Abre `https://tu-dominio.com/`
2. Verifica que las 6 cards aparezcan (Dashboard, Cargar Excel, Pickup, STLY, Venta por canal, Predicciones).
3. Entra a Dashboard → deben verse 4 KPI cards + 4 gráficos con datos del Excel.
4. Sube el Excel de nuevo desde el formulario → `ingest_log` debe tener un nuevo registro.

---

## 6. Troubleshooting común en Hostinger

| Problema | Causa | Fix |
|---|---|---|
| 500 en todos los endpoints | env vars no se cargaron | hPanel → Variables de entorno → "Guardar y reimplementar" (morado) |
| Tildes rotos ("Tel�fono") en respuesta | DB en latin1 | Re-importa con `utf8mb4`. Mira: `SHOW VARIABLES LIKE 'character_set_database';` debe ser `utf8mb4` |
| `MODULE_NOT_FOUND: mysql2` | No instalaste deps en prod | SSH → `cd public_html/frontend && npm install --production` |
| Frontend sirve pero API da 404 | Falta `.htaccess` rewrite | Crea el `.htaccess` del paso 2.8 |
| Logs vacíos | Restart no basta | Click "Guardar y reimplementar" (botón morado) en hPanel |
| max_allowed_packet error al subir Excel | MySQL Hostinger limita a 16 MB por default | hPanel → MySQL → "Edit PHP Variables" no aplica a MySQL. Solución: divide el Excel o sube por SSH |

---

## 7. Resumen ejecutivo

**Para llegar a producción lo más rápido posible:**

1. **Ahora (10 min)**: Ya está. Tienes `docs/seed_data.sql` listo.
2. **Decisión (5 min)**: ¿Plan A (migrar a Next.js) o Plan B (split)?
3. **Ejecutar**:
   - Plan A: 4-6 h de migración TS + 30 min de deploy = **1 día de trabajo**
   - Plan B: 1 h de setup Railway + 30 min de deploy = **~2 h de trabajo**
4. **Verificar**: 30 min de smoke tests.

**Mi voto**: Plan A. Una sola plataforma, sin costos recurrentes, y aprendes el patrón de API Routes que te sirve para los próximos proyectos.
