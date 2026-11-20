# Gym PWA — Especificación de vistas, flujos y datos

Nov 17, 2026 · @Andres · v2 (pulida para diseño; decisiones en `docs/plans/2026-11-17-0948-feat-gym-pwa-vistas-plan.md`)

## Visión e inspiración

Una PWA mobile-first y offline-first para crear rutinas, ejecutarlas con el menor número de toques posible y ver el progreso de forma visual. Cada rutina guarda su propio historial, pero los ejercicios son globales: así se puede comparar un ejercicio dentro de la rutina y entre rutinas.

Cada persona entra con su email y un código de 6 dígitos, y sus datos se sincronizan en la nube, así que cambiar de móvil no cuesta el historial. Aun así, en el gym todo funciona sin señal.

**Principios de producto**

- **Registrar en el gym debe tomar menos de 3 toques por serie**: el peso y las reps vienen precargados de la sesión anterior; solo se confirma o se ajusta.
- **El contexto aparece justo donde se necesita**: el dato de la sesión pasada vive en la misma fila de la serie, no en otra pantalla.
- **Funciona sin señal**: los gyms suelen tener mala cobertura, así que todo se guarda localmente primero y se sincroniza al volver la conexión. Una sesión caducada nunca bloquea registrar un entreno.
- **Pulgar primero**: las acciones principales quedan en el tercio inferior de la pantalla, con áreas táctiles de 48 px o más.

**Qué tomamos de cada app**

| App | Qué copiamos | Dónde se usa |
| --- | --- | --- |
| Hevy | Feed de rutinas en carpetas, tabla de series con columna "Anterior", resumen al terminar con PRs | Inicio, Entreno activo, Finalizar |
| Strong | Tabla de series ultra compacta, temporizador de descanso automático al marcar la serie, "actualizar plantilla" al terminar | Entreno activo, Finalizar |
| GitHub | Mapa de calor de contribuciones (año en cuadrícula de días) | Historial |
| Fitbod | Mapa corporal de músculos entrenados y su recuperación | Progreso |
| Apple Fitness | Anillo de objetivo semanal y rachas | Inicio |
| MacroFactor / MyFitnessPal | Diario de comidas, escáner de código de barras, gráfico de peso con tendencia suavizada | Fases futuras |
| Spotify | Mini-reproductor persistente: el entreno activo sigue visible al navegar | Toda la app |

## Arquitectura de navegación

Barra inferior con 4 pestañas y un mini-reproductor del entreno activo que flota sobre ella mientras hay una sesión en curso.

| Pestaña | Icono sugerido | Contiene | Vistas hijas |
| --- | --- | --- | --- |
| Inicio | Casa / pesas | Feed de rutinas, objetivo semanal, iniciar entreno | Detalle de rutina, Crear/editar rutina, Selector de ejercicios |
| Historial | Calendario | Mapa de calor, lista de sesiones | Detalle de sesión |
| Progreso | Gráfico | Dashboard, récords, mapa muscular | Detalle de ejercicio; en el futuro Cuerpo y Nutrición |
| Perfil | Persona | Ajustes, cuenta y sincronización, biblioteca de ejercicios, exportar datos | Biblioteca, Ajustes, Rutinas archivadas |

**Capas globales (no son pestañas)**

- **Entreno activo**: pantalla completa que se abre desde cualquier sitio; al minimizarla queda como mini-reproductor (nombre de rutina + cronómetro + descanso restante).
- **Temporizador de descanso**: hoja inferior (bottom sheet) sobre el entreno activo.
- **Indicador de sincronización**: icono discreto y siempre visible (por ejemplo en la cabecera de cada pestaña) con tres estados: sincronizado, pendiente y sin conexión. Al tocarlo lleva al detalle en V12.
- **Modales**: confirmar descartar entreno, crear ejercicio personalizado, editar serie.

## Vistas del MVP y v1.1

Son 14 vistas: VA, V0–V12. Cada una indica propósito, contenido y estados que el diseñador debe cubrir.

### VA · Acceso

- Paso 1: logo, una frase de propuesta, campo de email y botón "Enviar código".
- Paso 2: "Te enviamos un código a tu@email.com", campo de 6 dígitos (teclado numérico, autocompletado desde el SMS/email cuando el sistema lo ofrezca), "Reenviar código" con cuenta atrás y "Cambiar email".
- No hay enlace mágico: en un iPhone con la app instalada, un enlace se abriría en Safari y no iniciaría sesión dentro de la app. El código funciona igual en todas partes.
- Aparece antes de V0 la primera vez y tras cerrar sesión. Cualquier persona con email puede registrarse (el primer código verificado crea la cuenta), y cada cuenta ve solo sus datos.
- **Estados**: normal, enviando, introducir código, código incorrecto, código caducado, demasiados intentos (espera), sin conexión ("Necesitas conexión para entrar la primera vez").
- Una vez dentro, la sesión se mantiene. Si caduca sin señal, la app sigue funcionando y pide reconectar solo cuando vuelve la conexión, con un aviso no bloqueante.

### V0 · Onboarding (3 pasos, solo la primera vez)

- Paso 1: unidades (kg / lb) y nombre.
- Paso 2: objetivo de días por semana (selector 1–7) y descanso por defecto (60 / 90 / 120 / 180 s).
- Paso 3: invitación a instalar la PWA ("Añadir a pantalla de inicio") y permiso de notificaciones para el descanso.

### V1 · Inicio (feed principal)

- **Cabecera**: saludo + fecha, racha actual en semanas, anillo de objetivo semanal (ej. 3/4 días).
- **Tira de la semana**: L–D con punto relleno en los días entrenados.
- **CTA principal**: "Empezar entreno vacío" y "Nueva rutina".
- **Sugerencia "Toca hoy"**: si hay carpetas marcadas como *programa en ciclo*, sugiere la siguiente rutina del ciclo entrenado más recientemente (ej. última sesión Pull en el ciclo Push → Pull → Legs, así que toca Legs). Si no hay ciclos, sugiere la rutina activa que más días lleva sin hacerse. Las archivadas nunca se sugieren.
- **Mis rutinas**: agrupadas en carpetas plegables (ej. "Push/Pull/Legs"). Una carpeta en ciclo muestra un distintivo de ciclo y sus rutinas numeradas en orden. Cada tarjeta muestra nombre, color, nº de ejercicios, lista corta de ejercicios, última vez ("hace 3 días"), duración media y botón ▶ Iniciar.
- **Menú de carpeta (⋯)**: renombrar, marcar o desmarcar como programa en ciclo, reordenar rutinas, eliminar carpeta (sus rutinas pasan a "Sin carpeta").
- **Menú de tarjeta (⋯)**: editar, duplicar, mover a carpeta, archivar, eliminar.
  - *Archivar*: quita la rutina del feed y de "Toca hoy"; se recupera desde "Rutinas archivadas" (enlace al final del feed y en V12).
  - *Eliminar* (con confirmación): borra la plantilla, pero sus sesiones se conservan en Historial y Progreso con el nombre guardado y la etiqueta "(eliminada)".
- **Estados**: vacío (ilustración + "Crea tu primera rutina"), entreno en curso (banner "Continuar entreno"), sin conexión (indicador global, sin bloquear nada).

### V2 · Detalle de rutina

- Cabecera: nombre, color, notas de la rutina, botón grande ▶ Iniciar.
- Pestañas internas: **Ejercicios** | **Historial** | **Estadísticas**.
- Ejercicios: lista con series × rango de reps y peso objetivo.
- Historial: sesiones solo de esta rutina (fecha, duración, volumen, energía, RPE medio, nota). Tap abre V8.
- Estadísticas: volumen por sesión (línea), duración media, veces realizada, mejor sesión, energía media y RPE medio.

### V3 · Crear / editar rutina

- Nombre, color, carpeta, nota general.
- Botón "+ Añadir ejercicios" que abre V4 en modo selección múltiple.
- Por ejercicio (tarjeta reordenable con arrastre):
  - Series: número y tipo de cada una (Calentamiento, Normal, Drop set, Al fallo).
  - Objetivo según el tipo de registro: reps (fijo o rango 8–12) y peso opcional; reps y lastre opcional; o duración objetivo.
  - Descanso propio del ejercicio (sobrescribe el global).
  - Nota fija (ej. "agarre neutro, banco a 30°").
  - Agrupar en superserie con el siguiente ejercicio. La superserie solo agrupa visualmente y no cambia los descansos.
- Guardar / descartar cambios.

### V4 · Biblioteca y selector de ejercicios

- Catálogo inicial importado de una base abierta de ejercicios con imágenes, en español.
- Buscador + filtros por grupo muscular, equipamiento (barra, mancuerna, máquina, polea, peso corporal) y "Mis ejercicios".
- Lista con miniatura, nombre, músculo principal y "última vez: 80 kg × 8".
- Modo selección: casillas y contador "Añadir (3)".
- "Crear ejercicio": foto propia (cámara o galería, opcional; si no hay, icono por equipamiento), nombre, músculo principal, secundarios, equipamiento y tipo de registro (peso + reps, reps con lastre opcional, tiempo). Los músculos se eligen de la misma lista fija que usa el catálogo y el mapa muscular.
- Los ejercicios personalizados y sus fotos son privados de tu cuenta. Se pueden editar y, si no tienen historial, eliminar.
- **Estados**: búsqueda sin resultados (con atajo "Crear «texto buscado»"), sin conexión (las imágenes del catálogo que no estén en caché muestran el icono por equipamiento).

### V5 · Entreno activo (la pantalla más importante)

- **Cabecera fija**: nombre de la rutina, cronómetro total, botón Minimizar y botón Finalizar. Debajo, contadores en vivo: volumen y series completadas / totales.
- **Bloque por ejercicio**:
  - Nombre (tap = historial del ejercicio), nota fija, menú ⋯ (reemplazar, quitar, superserie, nota de hoy).
  - Chip **"En otra rutina"**: plegado muestra la sesión más reciente del ejercicio fuera de esta rutina, con su mejor serie, ej. "Pierna B · 12 nov · 80 kg × 8". Al tocarlo se despliega: más reciente, mejor marca histórica fuera de la rutina (mayor e1RM, ej. "Full body · 3 nov · 90 kg × 5") y enlace "Ver historial" a V11. Si el ejercicio nunca se hizo fuera de esta rutina, el chip no aparece.
  - Tabla de series según el tipo de registro:
    - Peso + reps: **Serie | Anterior | kg | Reps | RPE | ✓**
    - Reps con lastre: **Serie | Anterior | +kg | Reps | RPE | ✓** (lastre vacío = solo peso corporal)
    - Tiempo: **Serie | Anterior | Tiempo | RPE | ✓**, con botón para cronometrar la serie en vivo
  - **"Anterior"** = lo que hiciste en la fila con la misma posición la última vez que hiciste ESTA rutina (fila 3 con fila 3, sin importar el tipo de serie). Los campos vienen precargados con ese valor en gris. Si hoy hay más filas que la última vez, las filas extra muestran "—" y se precargan con la última fila del ejercicio. Consecuencia aceptada: si hoy añades un calentamiento antes, esa fila puede precargarse con el peso de trabajo.
  - **RPE (1–10)**: opcional por serie y no se precarga. Es la única medida de esfuerzo de la app.
  - Al tocar ✓: la fila se pone en color de éxito, muestra el ✓ relleno, vibra y arranca el temporizador de descanso de ese ejercicio.
  - "+ Añadir serie" y deslizar a la izquierda para borrar.
- **Superseries**: los ejercicios agrupados se muestran dentro de un mismo bloque con una barra lateral y una etiqueta "Superserie". Cada ✓ arranca su propio descanso (sin lógica especial). "Siguiente" en V6 sigue la alternancia A1 → B1 → A2 → B2.
- **Pie**: "+ Añadir ejercicio" y "Cancelar entreno".
- **Momentos especiales**:
  - Badge "PR" animado al superar una marca existente. La primera sesión de un ejercicio fija sus marcas sin badge. Máximo un badge por serie: si bate varias marcas, se muestra la de mayor rango (peso máximo > e1RM > reps con un peso).
  - Aviso si se sale con series sin marcar.
- **Técnico**: pantalla siempre encendida (Wake Lock) y guardado automático en el dispositivo en cada cambio. El entreno se sincroniza con la nube cuando hay conexión, sin que el usuario haga nada.

### V6 · Temporizador de descanso (hoja inferior)

- Anillo circular con cuenta regresiva grande.
- Botones −15 s, +15 s y Saltar.
- Muestra la siguiente serie pendiente: "Siguiente: Press banca · Serie 3 · 80 kg × 8". En una superserie sigue la alternancia (tras A1 muestra B1).
- Al terminar: vibración, sonido corto y notificación si la app está en segundo plano.
- Se puede plegar: queda como barra de progreso en la cabecera de V5.

### V7 · Finalizar entreno

- Resumen: duración, volumen total, series, reps, PRs conseguidos.
- Comparación con la sesión anterior de la rutina: Δ volumen (+4,2 %), Δ duración.
- **Sensaciones**: energía 1–5 (caritas) y etiquetas rápidas (Dormí mal, Con dolor, Gran pump, Poco tiempo). Debajo, el RPE medio de la sesión calculado de las series (solo lectura; se oculta si no registraste RPE).
- **Nota libre** de la sesión.
- **"¿Actualizar la rutina con estos cambios?"** aparece si añadiste, quitaste o reordenaste ejercicios, si cambiaste el número o tipo de series, o si el peso hecho difiere del peso objetivo. Muestra la lista de cambios (ej. "Press banca: +1 serie · objetivo 80 → 82,5 kg") y ofrece Sí o Solo esta vez. No aparece en entrenos libres (ahí está "Guardar como rutina nueva").
- Botones Guardar y Descartar (con confirmación).
- Pantalla de celebración breve al guardar (estilo Hevy), compartible como imagen.

### V8 · Detalle de sesión

- Igual que el resumen de V7 pero de solo lectura: fecha, rutina, duración, sensaciones, nota y cada ejercicio con sus series.
- Acciones: editar sesión, repetir este entreno, eliminar. Editar o eliminar recalcula los PRs y las métricas afectadas.
- Si la rutina de origen se eliminó, la cabecera muestra su nombre con la etiqueta "(eliminada)" y "Repetir" crea un entreno libre con los mismos ejercicios.

### V9 · Historial

- **Mapa de calor anual** estilo GitHub: columnas = semanas, filas = L–D. Intensidad del color = series completadas del día (4 niveles + vacío). Se usan series y no volumen para que los días de peso corporal o isométricos no aparezcan vacíos. Selector de año.
- Interruptor de vista: Año (mapa de calor) | Mes (calendario con puntos de color por rutina).
- Indicadores: racha actual, mejor racha, días entrenados este año, % de adherencia.
- Tap en un día: lista de sesiones de ese día.
- Debajo: lista cronológica de sesiones agrupada por semana, filtrable por rutina.

### V10 · Progreso (dashboard)

- Selector de periodo: 4 semanas | 3 meses | 1 año | Todo.
- **Tarjetas KPI**: entrenos, volumen total, duración media, series totales; cada una con su Δ frente al periodo anterior.
- **Gráficos**: volumen semanal (barras), frecuencia semanal frente al objetivo, series por grupo muscular (barras horizontales con banda recomendada 10–20).
- **Mapa muscular corporal** (frontal y dorsal) coloreado por series de la semana.
- **Récords recientes**: últimos PRs con fecha.
- **Ejercicios destacados**: top 5 con su curva de 1RM estimado en miniatura; tap abre V11.

### V11 · Detalle de ejercicio

- Gráfico de 1RM estimado, peso máximo y volumen por sesión a lo largo del tiempo. En ejercicios de reps se grafican reps máximas y lastre; en ejercicios de tiempo, la duración máxima.
- Récords: peso máximo, mejor 1RM estimado, más reps con un peso, mejor volumen en una sesión. En reps: más reps en una serie y mayor lastre. En tiempo: mayor duración.
- Historial de todas las sesiones donde aparece, indicando la rutina de cada una.
- Filtro "Solo en rutina X" para comparar entre rutinas.

### V12 · Perfil y ajustes

- Cuenta: nombre y email, estado de sincronización con la hora de la última sincronización ("Sincronizado hace 2 min" / "3 cambios pendientes" / "Sin conexión"), botón "Sincronizar ahora" y cerrar sesión (avisa si hay cambios pendientes sin subir).
- Preferencias: nombre, unidades, objetivo semanal, descanso por defecto, inicio de semana (lunes/domingo).
- Entreno: sonido y vibración del descanso, mantener pantalla encendida, precargar valores anteriores.
- Datos: exportar e importar (JSON y CSV), borrar todos mis datos (con confirmación fuerte; borra también los de la nube).
- Apariencia: tema oscuro / claro / sistema.
- Accesos: biblioteca de ejercicios (V4 en modo gestión) y rutinas archivadas (restaurar o eliminar).

## Vistas futuras

Estas vistas entran como sub-pestañas dentro de Progreso (Entreno | Cuerpo | Nutrición), así la navegación principal no cambia.

### V13 · Cuerpo: peso y medidas

- Registro rápido de peso (teclado numérico grande, fecha por defecto hoy).
- Gráfico de peso con **línea de tendencia suavizada** (media móvil de 7 días, estilo MacroFactor) sobre los puntos diarios.
- Medidas opcionales: cintura, pecho, brazo, muslo, % grasa.
- Indicador de ritmo: "−0,3 kg/semana" frente al objetivo.

### V14 · Fotos de progreso

- Galería por fecha con poses: frente, perfil, espalda.
- Cámara con silueta guía superpuesta para repetir el mismo encuadre.
- **Comparador**: dos fechas lado a lado o con deslizador antes/después, mostrando el peso de cada fecha.
- Privacidad: fotos solo en el dispositivo por defecto, con bloqueo opcional.

### V15 · Nutrición

- Resumen del día: anillo de calorías y barras de proteína, carbohidratos y grasa frente a los objetivos.
- Comidas del día (Desayuno, Almuerzo, Cena, Snacks) con "+ Añadir".
- Añadir alimento: buscador, recientes, favoritos, escáner de código de barras, alimento personalizado y comidas guardadas.
- Ajuste de porción (gramos o unidades) con macros en vivo.
- Historial semanal de calorías y adherencia.
- Base de datos sugerida: Open Food Facts (gratuita y con códigos de barras).

### V16 · Dashboard unificado (cuando existan los tres módulos)

- Tarjeta por semana que cruza entreno, peso y calorías.
- Correlaciones: peso frente a calorías promedio, volumen frente a calorías, sensaciones frente a horas de sueño (si se registra).

## Métricas propuestas

Todas se calculan a partir de las series completadas, excluyendo las de calentamiento salvo que se indique lo contrario.

| Métrica | Cómo se calcula | Dónde se ve |
| --- | --- | --- |
| Volumen | Suma de peso × reps de cada serie. En peso corporal cuenta solo el lastre (lastre × reps; 0 sin lastre). Los ejercicios de tiempo no suman volumen | V5, V7, V10, V2 |
| 1RM estimado (e1RM) | Fórmula de Epley: peso × (1 + reps / 30), tomando la mejor serie | V11, V10 |
| Series por grupo muscular | Series del músculo principal = 1; de músculos secundarios = 0,5. Por semana | V10, mapa muscular |
| Frecuencia | Días con al menos una sesión por semana | V9, V10, V1 |
| Adherencia | Días entrenados / días objetivo del periodo, en % | V9, V10 |
| Racha | Semanas consecutivas cumpliendo el objetivo semanal (más amable que días seguidos) | V1, V9 |
| Duración media | Promedio de (fin − inicio) de las sesiones | V2, V10 |
| Densidad | Volumen / minutos de la sesión | V7, V2 |
| Sobrecarga progresiva | Δ % de e1RM o volumen del ejercicio frente a hace 4 semanas | V11, V10 |
| Récords (PR) | Peso + reps: peso máximo, mejor e1RM, más reps con un peso, mayor volumen en una sesión. Reps: más reps en una serie, mayor lastre. Tiempo: mayor duración. La primera sesión de cada ejercicio fija la base sin badge | V5 (en vivo), V7, V11 |
| Balance de empuje / tirón / pierna | Series por patrón de movimiento, en % del total | V10 |
| Descanso real | Tiempo entre marcar una serie y la siguiente, comparado con el planificado | V7, V8 |
| Sensación media | Energía media (1–5) y RPE medio de las series con RPE, mostrados por separado | V2, V10 |
| Series del día | Series completadas por día (incluye todos los tipos de registro) | V9 (mapa de calor) |

```latex
\text{e1RM} = w \left(1 + \frac{r}{30}\right)
```

Donde w es el peso y r las repeticiones de la serie. Se vuelve poco fiable por encima de 12 reps, así que esas series no cuentan para el e1RM.

## Flujos principales

### F0 · Primera apertura

1. VA → escribir email → "Enviar código" → teclear el código de 6 dígitos (requiere conexión).
2. V0 en 3 pasos.
3. V1 en estado vacío.

### F1 · Crear una rutina

1. Inicio (V1) → "Nueva rutina".
2. V3: escribir nombre, elegir color y carpeta.
3. "+ Añadir ejercicios" → V4 en modo selección: buscar, filtrar, marcar varios → "Añadir (n)".
4. De vuelta en V3: por cada ejercicio fijar nº de series, reps objetivo, descanso; reordenar arrastrando.
5. Guardar → vuelve a V1 con la nueva tarjeta resaltada.

### F2 · Ejecutar una rutina

1. V1 o V2 → ▶ Iniciar. Se crea la sesión y arranca el cronómetro.
2. V5 carga los ejercicios con los valores de la última sesión de esa rutina en gris y el chip "En otra rutina" si existe.
3. Por cada serie: ajustar kg / reps (o tiempo) y, si quieres, RPE → ✓.
4. Al marcar ✓ se abre V6 con el descanso del ejercicio; al terminar avisa con vibración y notificación.
5. Si se supera un récord aparece el badge PR en esa fila.
6. El usuario puede minimizar y navegar; el mini-reproductor mantiene cronómetro y descanso visibles.
7. "Finalizar" → V7.

### F3 · Finalizar y anotar

1. V7 muestra el resumen y la comparación con la sesión anterior.
2. El usuario marca energía, etiquetas y escribe la nota.
3. Si hubo cambios de estructura o de peso objetivo: revisa la lista y elige "Actualizar rutina" o "Solo esta vez".
4. Guardar → pantalla de celebración → V1. El día se pinta en el mapa de calor y la sesión se sincroniza cuando haya conexión.

### F4 · Revisar progreso

1. Progreso (V10) → elegir periodo.
2. Leer KPIs y mapa muscular; tocar un ejercicio destacado → V11.
3. En V11 filtrar por rutina para comparar el mismo ejercicio entre rutinas.

### F5 · Recuperar un entreno interrumpido

1. Si la app se cierra o el móvil se reinicia con una sesión abierta, al volver aparece el banner "Tienes un entreno en curso".
2. Opciones: Continuar (vuelve a V5 con el tiempo real transcurrido) o Descartar.
3. Sesiones abiertas más de 6 horas se ofrecen para guardar con la hora de la última serie como hora de fin.

### F6 · Entreno libre

1. V1 → "Empezar entreno vacío" → V5 sin ejercicios.
2. Añadir ejercicios sobre la marcha desde V4.
3. En V7 aparece la opción "Guardar como rutina nueva".

### F7 · Entreno sin señal

1. En el gym sin cobertura: V1 → ▶ Iniciar. El indicador global muestra "sin conexión".
2. V5 y V7 funcionan igual; todo se guarda en el dispositivo.
3. Al guardar, el indicador sigue en "sin conexión" y muestra cuántos cambios hay pendientes.
4. Al recuperar la señal el indicador pasa a "pendiente", se sincroniza solo y vuelve a "sincronizado". Si la sesión caducó, aparece un aviso no bloqueante para pedir un código nuevo; nada se pierde mientras tanto.

### F8 · Archivar y eliminar rutinas

1. V1 → ⋯ en la tarjeta → Archivar: la rutina desaparece del feed y de "Toca hoy".
2. V12 → Rutinas archivadas → Restaurar o Eliminar.
3. Eliminar (con confirmación) borra la plantilla; sus sesiones siguen en Historial y Progreso como "Nombre (eliminada)".

## Modelo de datos

La clave del diseño: **plantilla** (Routine) y **ejecución** (Workout) son entidades separadas, y los ejercicios son un catálogo global. Así "sesión anterior de esta rutina" filtra por `routineId` y "en otra rutina" filtra por `exerciseId` con un `routineId` distinto.

| Entidad | Campos principales | Notas |
| --- | --- | --- |
| User | id, email, name, createdAt | Cuenta (gestionada por la librería de autenticación); todas las demás entidades (salvo el catálogo base) llevan userId. Toda entidad sincronizable lleva además updatedAt, deletedAt y version (ver plan) |
| Settings | userId, unit (kg/lb), weeklyGoal, weekStart, theme, preloadPrevious, soundOn | Uno por usuario |
| Muscle | id, name, region (front, back) | Lista fija; la usan el catálogo, los personalizados y el mapa muscular |
| Exercise | id, userId? (null = catálogo base), name, primaryMuscle, secondaryMuscles\[\], equipment, trackingType (weight\_reps, reps, time), isCustom, imageUrl? | Catálogo base de una fuente abierta + personalizados privados |
| Folder | id, name, order, isCycle | isCycle = programa en ciclo; el orden de sus rutinas define la secuencia |
| Routine | id, name, color, folderId?, notes, order, archived, deletedAt?, createdAt, updatedAt | Plantilla; eliminar es borrado lógico para conservar el nombre en el historial |
| RoutineExercise | id, routineId, exerciseId, order, restSec?, note, supersetGroup? | Ejercicio dentro de la plantilla |
| RoutineSet | id, routineExerciseId, order, type (warmup, normal, drop, failure), targetRepsMin, targetRepsMax, targetWeight?, targetDurationSec? | Series planificadas |
| Workout | id, routineId? (null si es libre), name (copia del nombre de la rutina), startedAt, endedAt?, status (active, finished, discarded), energy 1–5, tags\[\], note | Una sesión; sin esfuerzo global (se usa el RPE medio) |
| WorkoutExercise | id, workoutId, exerciseId, routineExerciseId?, order, restSec?, note | Copia del ejercicio en la sesión; `restSec` se copia de la rutina y se cambia en el entreno (null = sin descanso) |
| WorkoutSet | id, workoutExerciseId, order, type, weight (o lastre), reps, durationSec?, rpe?, completed, completedAt? | Lo realmente hecho |
| PersonalRecord | — | No se guarda: los récords se calculan en el dispositivo a partir de las sesiones, así editar o borrar una sesión los corrige solo |
| BodyMetric (futuro) | id, date, weightKg, waist, chest, arm, thigh, bodyFatPct | V13 |
| ProgressPhoto (futuro) | id, date, pose (front, side, back), blobRef, weightKg? | V14; imágenes en IndexedDB como Blob |
| Food / FoodLog (futuro) | Food: id, name, barcode?, kcal, protein, carbs, fat por 100 g. FoodLog: id, date, meal, foodId, grams | V15 |

**Consultas clave**

- *Anterior en esta rutina*: último Workout terminado con el mismo routineId → sus WorkoutSet del mismo exerciseId, emparejados por order (posición, sin importar el tipo). Filas sin pareja se precargan con la última fila.
- *En otra rutina*: (a) último Workout terminado con el mismo exerciseId y otro routineId (o libre) → su mejor serie; (b) mejor serie histórica por e1RM con esa misma condición.
- *Toca hoy*: carpeta en ciclo con la sesión más reciente → rutina siguiente a la última hecha; sin ciclos → rutina no archivada con el último Workout más antiguo.
- *Mapa de calor*: Workouts terminados agrupados por fecha local → nº de series completadas por día.
- *Series por músculo*: WorkoutSet completados de la semana × músculos de su Exercise.

**Por qué copiar a WorkoutExercise/WorkoutSet**: si luego editas o borras la rutina, el historial queda intacto.

## Requisitos PWA y técnicos

Stack para un MVP local-first que sincroniza con la nube desde el primer día. El detalle y el porqué de cada decisión están en el plan (`docs/plans/2026-11-17-0948-feat-gym-pwa-vistas-plan.md`).

| Capa | Elección | Motivo |
| --- | --- | --- |
| Estructura | Monorepo pnpm: `apps/web`, `apps/api`, `packages/domain`, `packages/contract` | Reglas y tipos compartidos entre app y API |
| Frontend | React + TypeScript + Vite (SPA), React Router, Tailwind CSS v4 + shadcn/ui | La app lee del dispositivo; un SPA estático funciona sin conexión en cualquier ruta |
| PWA | vite-plugin-pwa (injectManifest) | Precarga, caché de imágenes del catálogo, notificación de fin de descanso, aviso de actualización |
| Datos locales | IndexedDB con Dexie.js + live queries | Única fuente de datos de las pantallas; el entreno activo es una fila más |
| Backend | Express (TypeScript) | API pequeña: acceso, sincronización y subida de fotos |
| Base de datos | Neon Postgres + Drizzle ORM | Esquema tipado y migraciones |
| Acceso | Better Auth con código de 6 dígitos por email, enviado con Resend | Funciona dentro de la PWA instalada en iPhone |
| Sincronización | Cola de cambios local + push/pull con versión del servidor; gana la última escritura | Simple y suficiente para una persona con varios dispositivos |
| Fotos | Vercel Blob (catálogo y ejercicios propios) | Subida directa desde el cliente con token |
| Catálogo de ejercicios | free-exercise-db, traducido al español y mapeado a la lista fija de músculos, como JSON versionado | Catálogo amplio con imágenes desde el primer día |
| Gráficos | Recharts; mapa de calor y mapa muscular como SVG propio | Control total del estilo |
| Hosting | Vercel, un solo proyecto con Vercel Services (web + api en el mismo dominio) | Cookie de sesión en el mismo origen, despliegues atómicos |
| Pruebas | Vitest, fake-indexeddb, PGlite, Playwright | Sin depender de una base de datos real en los tests |

**APIs del navegador a usar**

- **Screen Wake Lock**: pantalla encendida durante V5.
- **Vibration** y **Notifications** (desde el service worker): fin del descanso.
- **Timers basados en marca de tiempo**: guardar `restEndsAt` y calcular el restante; los `setInterval` se congelan en segundo plano.
- **Storage persistence** (`navigator.storage.persist()`): evita que el navegador borre los datos.
- **Badging API**: punto en el icono si hay un entreno en curso.

**Limitaciones a tener en cuenta**

- En iOS las notificaciones web solo funcionan si la PWA está instalada en la pantalla de inicio (iOS 16.4+). El onboarding debe empujar la instalación.
- iOS no garantiza la ejecución en segundo plano: el aviso de descanso puede retrasarse si la app está cerrada; la solución más fiable es recalcular al volver y mostrar el estado correcto.
- Las fotos (de ejercicios personalizados ahora, de progreso en el futuro) pueden ocupar mucho: comprimir a WebP antes de guardar y subir.
- En iOS, la PWA instalada no recibe enlaces ni comparte sesión con Safari; por eso el acceso es por código y no por enlace. La primera apertura necesita conexión.
- Para enviar códigos a cualquier email hace falta un dominio propio verificado en Resend.
- El registro es abierto: cualquiera con la URL puede crear cuenta y subir fotos. Sin límites de cuota en esta fase (riesgo aceptado).

## Brief para el agente diseñador

Copia este bloque tal cual como instrucción inicial; añade tu paleta de colores donde se indica.

```markdown
Diseña las pantallas mobile-first (390 × 844) de una PWA de registro de entrenamiento de gimnasio.

PALETA: [pegar aquí la paleta: primario, acento, fondo, superficie, texto, éxito, alerta]
TEMA: oscuro por defecto (se usa en el gym), con variante clara.

PANTALLAS A ENTREGAR (por orden de prioridad):
1. V5 Entreno activo: cabecera con cronómetro, bloques de ejercicio con tabla según tipo (kg | Reps, +kg | Reps, Tiempo) más RPE opcional y ✓, columna "Anterior" (incluida una fila extra con "—"), chip "En otra rutina" plegado y desplegado, bloque de superserie, fila completada, badge PR.
2. V6 Temporizador de descanso (hoja inferior expandida y plegada).
3. V1 Inicio: anillo de objetivo semanal, tira de la semana, "Toca hoy", carpetas normales y en ciclo con tarjetas de rutina.
4. V3 Crear/editar rutina y V4 Selector de ejercicios (modo selección múltiple y "Crear ejercicio" con foto).
5. V7 Finalizar entreno: resumen, comparación, energía y etiquetas, RPE medio, nota, lista de cambios para "Actualizar rutina" y celebración.
6. VA Acceso por email y código de 6 dígitos (2 pasos) y V0 Onboarding (3 pasos).
7. V2 Detalle de rutina y V8 Detalle de sesión.
8. V12 Perfil: cuenta y sincronización, ajustes, rutinas archivadas.
9. V9 Historial: mapa de calor anual estilo GitHub (por series) + vista mes.
10. V10 Progreso: KPIs, gráficos de volumen y frecuencia, mapa muscular, récords. V11 Detalle de ejercicio.

PARA CADA PANTALLA: estado normal, vacío y con datos largos (nombres extensos, 10+ series). Donde aplique, también sin conexión y con cambios pendientes de sincronizar.

COMPONENTES REUTILIZABLES: barra inferior de 4 pestañas, mini-reproductor de entreno activo, indicador de sincronización (sincronizado / pendiente / sin conexión), tarjeta de rutina, cabecera de carpeta (normal / en ciclo), fila de serie (pendiente / completada / PR, en sus tres tipos de registro), chip de dato previo (plegado / desplegado), contenedor de superserie, tarjeta KPI con delta, celda de mapa de calor (5 niveles), anillo de progreso, bottom sheet, input numérico grande con stepper, campo de código de 6 dígitos.

REGLAS:
- Acciones principales en el tercio inferior; áreas táctiles ≥ 48 px.
- Números con cifras tabulares y tamaño grande en el entreno activo.
- Contraste AA mínimo; el estado completado no puede depender solo del color (usar también ✓).
- Microinteracciones: marcar serie, PR, fin de descanso.
- Inspiración: Hevy y Strong (registro), GitHub (mapa de calor), Fitbod (mapa muscular), Apple Fitness (anillos).
```

## Roadmap por fases

| Fase | Alcance | Vistas |
| --- | --- | --- |
| MVP | Cuenta con email y código, sync en la nube, crear rutinas y carpetas en ciclo, ejecutar con temporizador, registro por peso + reps, reps con lastre y tiempo, historial por rutina, dato anterior y de otra rutina, notas, exportar datos, PWA offline | VA, V0–V8, V12 |
| v1.1 | Mapa de calor, dashboard de progreso, récords, mapa muscular | V9–V11 |
| v2 | Peso y medidas, fotos de progreso | V13, V14 |
| v3 | Nutrición, dashboard unificado, registro por distancia (cardio) | V15, V16 |

El diseño de esta fase cubre MVP y v1.1 (VA, V0–V12). V13–V16 son solo contexto.

**Decisiones cerradas** (antes eran preguntas abiertas; detalle en el plan de requisitos)

- Organización: carpetas, y cualquiera puede marcarse como *programa en ciclo* (A → B → C) para alimentar "Toca hoy".
- Tipos de registro del MVP: peso + reps, reps con lastre opcional y tiempo. Distancia queda para v3.
- Usuarios: cuentas por email con código de 6 dígitos, registro abierto y datos aislados por cuenta; sincronización en la nube desde el MVP. Google queda para más adelante.

**Resuelto en la planificación técnica**

- Catálogo: free-exercise-db, traducido una vez al español y mapeado a la lista fija de músculos.
- Fotos de ejercicios propios: WebP de 1080 px como máximo.
- Unidades: se guarda en kg y segundos; lb solo en pantalla.
