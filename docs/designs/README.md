# Diseños

Aquí van los diseños de la app, una carpeta por vista. La fuente de verdad de qué debe mostrar cada pantalla es `docs/spec/gym-pwa-spec.md`.

## Decisiones al integrar el lienzo de V5 y V6

- La paleta (Sol, Atardecer, Arena, Polvo, Hierro, Asfalto, Concreto, Océano) y las fuentes Anton y Archivo ya son los tokens del tema en `apps/web/src/ui/theme.css`.
- V5 es un carrusel horizontal por ejercicio, así que borrar una serie va por menú, no deslizando, para no chocar con el gesto del carrusel.
- V6 es pantalla completa; minimizada queda como barra de descanso en el pie de V5.
- Badge PR: si una serie bate varias marcas, se muestra la de mayor rango (peso máximo > e1RM > reps con un peso), según el plan.
- VA ya no es "acceso con Google": es email + código de 6 dígitos (ver la especificación).
- Áreas táctiles: el lienzo usa 44 px y la especificación pide 48 px; se mantiene 48 px hasta decidir lo contrario.
- El mockup "Hoy" (calorías, pasos, peso) corresponde a V13–V16 y queda fuera del alcance actual.
- Pendiente: nombre de la app (sustituye a "Iron Shore").

## Estructura

```
docs/designs/
  VA-acceso/
  V0-onboarding/
  V1-inicio/
  V2-detalle-rutina/
  V3-crear-editar-rutina/
  V4-ejercicios/
  V5-entreno-activo/
  V6-descanso/
  V7-finalizar/
  V8-detalle-sesion/
  V9-historial/
  V10-progreso/
  V11-detalle-ejercicio/
  V12-perfil/
  componentes/
```

## Nombres de archivo

`<vista>-<estado>-<tema>.png`, por ejemplo `V5-normal-oscuro.png`, `V5-superserie-oscuro.png` o `V1-vacio-claro.png`.

Estados habituales: `normal`, `vacio`, `datos-largos`, `sin-conexion`, `pendiente-sync`.

## Estado de entrega

Orden de prioridad del brief del diseñador.

| # | Vista | Estado |
| --- | --- | --- |
| 1 | V5 Entreno activo | En lienzo (7 artboards), ver `2026-11-17-v5-v6-lienzo.md` |
| 2 | V6 Descanso | En lienzo (3 artboards), ver `2026-11-17-v5-v6-lienzo.md` |
| 3 | V1 Inicio | Pendiente |
| 4 | V3 Crear/editar rutina · V4 Ejercicios | Pendiente |
| 5 | V7 Finalizar | Pendiente |
| 6 | VA Acceso · V0 Onboarding | Pendiente |
| 7 | V2 Detalle de rutina · V8 Detalle de sesión | Pendiente |
| 8 | V12 Perfil | Pendiente |
| 9 | V9 Historial | Pendiente |
| 10 | V10 Progreso · V11 Detalle de ejercicio | Pendiente |
| — | Componentes | Pendiente |
