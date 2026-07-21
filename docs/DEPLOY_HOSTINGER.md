# Deploy a Hostinger — Hotel Bora Bora RM

> Plan A: **Next.js fullstack en Hostinger Node.js + MySQL en el mismo plan.**

## Resumen

| Capa | Servicio | Plan recomendado |
|---|---|---|
| App (Next.js + API routes) | Hostinger Premium | Node.js (incluido) |
| Base de datos MySQL | Hostinger (mismo plan) | MySQL 8.0 |

Una sola cuenta, dos servicios. Sin Python, sin Railway.

---

## 1. Pre-flight

- ✅ Repo público en GitHub: `anubclao/RevenueMagnament`
- ✅ Rama `main` con `package.json` válido en la **raíz** del repo
- ✅ `docs/seed_data.sql` con toda la data (300 + 27,482 + 311 + 48 + 25 filas)
- ✅ `docs/init.sql` con el DDL limpio (alternativa al dump)
- ✅ TypeScript: `tsc --noEmit` sin errores
- ✅ Build: `npm run build` genera `.next/`

---

## 2. Crear la base de datos en Hostinger

1. hPanel → **Bases de datos MySQL** → **Crear nueva base de datos**
2. Anota:
   - **DB_HOST** (ej: `srv1234.hstgr.io`)
   - **DB_PORT** (típicamente `3306`)
   - **DB_USER** (ej: `u123456_admin`)
   - **DB_PASS** (la que pongas)
   - **DB_NAME** (ej: `u123456_bora_bora_rm`)
3. En **phpMyAdmin** (botón "Administrar" en hPanel):
   - Click en tu DB en el panel izquierdo
   - Pestaña **Importar**
   - Sube `docs/seed_data.sql` (7.2 MB)
   - Click **Continuar**
   - Espera 1-3 min. Debe decir: *"La importación se ejecutó exitosamente, X consultas ejecutadas."*
4. Verifica (pestaña SQL):
   ```sql
   SELECT COUNT(*) FROM stly_sales;        -- debe dar 27482
   SELECT COUNT(*) FROM dashboard_monthly;  -- debe dar 48
   SELECT COUNT(*) FROM channels;            -- debe dar 25
   ```

---

## 3. Crear la app Node.js en Hostinger

1. hPanel → **Avanzado** → **Aplicaciones Node.js** → **Crear**
2. Configuración:
   - **Versión de Node:** 20.x (LTS) o 18.18+
   - **Modo de inicio:** Production
   - **Directorio de la app:** `bora-bora-rm` (o el nombre que quieras)
3. Una vez creada, anota:
   - El **dominio o subdominio** asignado
   - El **directorio** donde se desplegó

---

## 4. Importar el repo

1. En la app Node.js → **Despliegues** o **Git**
2. Conectar GitHub (OAuth) si no lo has hecho
3. Selecciona `anubclao/RevenueMagnament`, rama `main`
4. Hostinger detecta Node.js (por el `package.json` raíz)
5. Build command: `npm run build` (configurable en settings)
6. Start command: `npm start` (configurable en settings)

### Variables de entorno

En la app Node.js → **Environment Variables** → agrega:

```
DB_HOST=srv1234.hstgr.io
DB_PORT=3306
DB_USER=u123456_admin
DB_PASS=<tu_password>
DB_NAME=u123456_bora_bora_rm
NODE_ENV=production
```

> ⚠️ **NO** se necesita `NEXT_PUBLIC_API_BASE_URL` — el frontend y el backend
> están en el mismo server, las rutas son relativas (`/api/...`).

---

## 5. Verificación post-deploy

1. Visita `https://tu-dominio.com/api/health` → debe devolver `{"ok":true,"db":true}`
2. Visita `https://tu-dominio.com/dashboard` → debe cargar con datos reales
3. Revisa logs en hPanel → **Avanzado** → **Aplicación Node.js** → tu app → **Logs**

---

## 6. Actualizar la app después

Cada `git push` a la rama `main` dispara un redeploy automático en Hostinger
(si configuraste auto-deploy). Si no:

1. hPanel → tu app → **Despliegues** → **Redeploy**

El nuevo build reemplaza el anterior sin downtime significativo.

---

## 7. Troubleshooting

| Error | Causa probable | Solución |
|---|---|---|
| `Cannot find module 'mysql2'` | No se instalaron deps | SSH → `cd ~/domains/<tu-dominio>/nodejs && npm install --production` |
| `ECONNREFUSED 127.0.0.1:3306` | `DB_HOST` mal configurado | Verifica el host en hPanel, NO es localhost, es `srvXXXX.hstgr.io` |
| `EACCES denied` en `.env` | Permisos | `chmod 600 .env.local` |
| Build falla con `EADDRINUSE` | Puerto ya en uso | Hostinger inyecta `PORT`, no hardcodear |
| Tabla `dashboard_monthly` vacía | Importaste `init.sql` en vez de `seed_data.sql` | DROP y re-importa con el dump completo |
| `Authentication failed` | `DB_PASS` mal copiado | Reset password en hPanel y actualiza env var, **reinicia la app** |

---

## 8. Comandos útiles (SSH)

```bash
# Conectar
ssh u123456@srv1234.hstgr.io

# Ver logs en vivo
tail -f ~/logs/nodejs/bora-bora-rm.log

# Reiniciar la app
hpanel-cli restart-node-app bora-bora-rm

# Test DB
mysql -u u123456_admin -p u123456_bora_bora_rm -e "SELECT COUNT(*) FROM stly_sales;"
```

---

## 9. Estructura del proyecto desplegado

```
~/domains/<tu-dominio>/nodejs/
├── package.json          # root, tiene build/start
├── package-lock.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── .env                  # NO commitear (env vars de Hostinger)
├── app/                  # Next.js App Router
│   ├── api/              # API routes (backend)
│   ├── dashboard/        # UI
│   ├── stly/, channels-sales/, etc.
│   └── ...
├── lib/                  # db.ts, api.ts, format.ts, etc.
├── components/
├── docs/                 # DEPLOY_HOSTINGER.md, seed_data.sql, etc.
└── .next/                # generado por npm run build
```
