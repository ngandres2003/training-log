# Training Log

App web instalable (PWA) para registrar entrenamientos de gimnasio. Funciona **sin conexión**: todo se guarda primero en el dispositivo y se sincroniza con el servidor cuando hay red.

## Qué hace

- **Rutinas**: crear, editar, ordenar en carpetas (incluidos programas en ciclo A → B → C) y archivar.
- **Entreno activo**: registrar series en pocos toques, con los valores de la última vez precargados, superseries, descanso opcional por ejercicio con temporizador y aviso, y mini-reproductor mientras navegas.
- **Finalizar**: resumen con volumen, récords y comparación con la sesión anterior; decide si la rutina aprende los cambios ("Sí" / "Solo esta vez").
- **Historial**: mapa de calor del año, calendario mensual y lista de sesiones filtrable.
- **Progreso**: KPIs por periodo, volumen y frecuencia semanal, series por músculo, mapa muscular, récords y detalle por ejercicio.
- **Perfil**: ajustes (unidad kg/lb, tema claro/oscuro, objetivo semanal), estado de sincronización, exportar/importar JSON y CSV, borrar datos.
- **Acceso por invitación**: no hay registro abierto. Un administrador genera un enlace único; la persona crea su contraseña y entra. Ver [docs/deploy.md](docs/deploy.md).

## Arquitectura

```
apps/
  web/        PWA en React + Vite + Tailwind. Datos locales en IndexedDB (Dexie) con outbox de cambios.
  api/        API Express en Node: Better Auth (sesiones), sincronización y subida de fotos.
packages/
  domain/     Reglas de producto puras y testeadas (récords, sugerencias, rachas, métricas…).
  contract/   Contrato de sincronización compartido por cliente y servidor (versionado).
scripts/      Utilidades (catálogo de ejercicios).
docs/         Especificación, plan de implementación, diseños y guía de despliegue.
```

- **Offline primero**: la app lee y escribe siempre en Dexie. Un motor de sincronización envía el outbox (`/api/sync/push`) y trae cambios (`/api/sync/pull`) con versiones por usuario. Gana la última edición.
- **Base de datos**: Postgres (Neon) con **Drizzle ORM**. Esquema en `apps/api/src/db/schema.ts`, migraciones en `apps/api/drizzle/`.
- **Autenticación**: Better Auth con email y contraseña, sesiones en cookie httpOnly de 60 días que se renuevan con el uso, y registro solo por invitación.
- **Fotos**: Vercel Blob con tokens de subida de corta duración limitados a imágenes de 2 MB.
- **Despliegue**: un proyecto de Vercel con dos servicios (`web` y `api`) en el mismo dominio (`vercel.json`).

## Requisitos

- Node 24 (`.nvmrc`)
- pnpm 11.1.1 (si tu pnpm global es más antiguo, usa `npx pnpm@11.1.1`)

## Desarrollo local

```sh
pnpm install

# API de prueba en memoria (sin base de datos ni servicios externos)
cd apps/api && E2E_TEST_MODE=1 PORT=3001 BETTER_AUTH_URL=http://localhost:5173 npx tsx src/e2e-server.ts

# En otra terminal: la web en http://localhost:5173 (redirige /api al puerto 3001)
cd apps/web && npx vite --port 5173
```

Con una base de datos real, copia `apps/api/.env.example` a `apps/api/.env`, rellénalo y ejecuta `pnpm dev`.

En desarrollo, **Perfil › Datos › "Cargar 4 meses de ejemplo"** llena la app con datos para ver Historial y Progreso.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm test` | Tests unitarios y de integración (Vitest; la API usa PGlite, sin Postgres) |
| `pnpm test:e2e` | Tests en navegador (Playwright) contra un build de producción |
| `pnpm typecheck` | TypeScript en todos los paquetes |
| `pnpm lint` | ESLint |
| `pnpm build` | Build de producción |

## Despliegue

Paso a paso en **[docs/deploy.md](docs/deploy.md)**: Vercel, Neon, Vercel Blob, variables de entorno, migraciones y cómo crear la primera cuenta de administrador.

## Documentación

- [docs/spec/gym-pwa-spec.md](docs/spec/gym-pwa-spec.md): especificación de producto (pantallas V0–V12 y flujos).
- [docs/plans/](docs/plans/): plan de implementación por unidades (U1–U18).
- [docs/designs/](docs/designs/): notas de diseño.

## Licencia

Apache 2.0. Ver [LICENSE](LICENSE).
