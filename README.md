<div align="center">
  <img src="studioroom/icon.svg" alt="Studio Room Logo" width="256" height="256">
</div>

# Studio Room

### Tu Estudio de Grabación Personal para Práctica de Instrumentos

---

## ¿Qué es Studio Room?

**Studio Room** es una suite de entrenamiento y grabación broadcast que transforma tu práctica de guitarra en una experiencia profesional. Diseñado para músicos comprometidos con su desarrollo, combina un entorno de práctica estructurado con capacidades de grabación de alta calidad y análisis posterior.

> *Deja de practicar en el vacío. Cada sesión queda documentada, medida y lista para tu revisión.*

---

## Características Principales

### 🎥 Grabación Broadcast con Overlay Profesional
- Captura tu webcam directamente al canvas con overlay estilo televisión profesional
- Indicadores **REC/PAUSE/STANDBY** con punto rojo animado
- Fecha, hora y día de práctica quemados en el video
- Nombre del ejercicio actual y siguiente ejercicio visible en pantalla
- Timers de ejercicio individual y sesión total en tiempo real
- Esquinas de viewfinder estilo cámara profesional

### Metrónomo Integrado
- Click track preciso usando Web Audio API
- Control de BPM en tiempo real (40-240 BPM)
- Sonido diferenciado para el tiempo 1 (downbeat) vs. tiempos 2, 3, 4
- Se graba junto con el video para referencia posterior

### Sistema de Rutinas Estructuradas
- **Plan de 52 semanas** con estructura diaria de 50 minutos
- 4 bloques por sesión: Técnica, Fretboard, Repertorio, Creatividad
- Progresión diaria que construye habilidades de forma incremental
- Selector visual de días con estado de completado

### Sistema de Rachas (Streaks)
- Seguimiento de días consecutivos de práctica
- Motivación visual con badge de racha en el header
- Persistencia en LocalStorage para no perder tu progreso

### Editor Visual de Rutinas
- Interfaz completa para crear y editar días de práctica
- Agregar, eliminar y reordenar ejercicios con drag & drop
- Preview JSON en tiempo real con syntax highlighting
- Atajos de teclado (Ctrl+S para guardar, Ctrl+N para nuevo día)
- Validación automática antes de guardar

### Persistencia y Exportación
- Todos los datos guardados en LocalStorage
- Videos exportados en formato WebM o MP4 (según soporte del navegador)
- Metadatos de segmentos en JSON para análisis posterior
- Nomenclatura automática: `Sesion_DiaX_Titulo_Fecha.ext`

### Diseño Profesional Dark Theme
- Paleta de colores ultra oscura (Studio Obsidian)
- Acentos en verde esmeralda neón
- Tipografía profesional: Inter + JetBrains Mono
- Glassmorphism en tarjetas y modales
- Responsive design para diferentes tamaños de pantalla

---

## Tecnologías

| Tecnología | Propósito |
|------------|-----------|
| **Vanilla JavaScript** | Lógica de aplicación sin dependencias |
| **Web Audio API** | Motor de metrónomo preciso |
| **MediaRecorder API** | Captura de video/audio |
| **Canvas API** | Renderizado del overlay broadcast |
| **HTML5 Dialog** | Modales accesibles |
| **LocalStorage** | Persistencia de datos |
| **Vite** | Bundling y dev server |

---

## Estructura del Proyecto

```
studioroom/
├── index.html          # Punto de entrada HTML
├── app.js              # Lógica principal (StudioApp + Metronome + RoutineEditor)
├── styles.css          # Sistema de estilos completo
├── routine.json        # Rutina por defecto (52 semanas)
└── package.json        # Configuración de Vite
```

---

## Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar servidor de desarrollo
```bash
npm run dev
```

### 3. Abrir en navegador
Visita `http://localhost:5173` y permite acceso a tu cámara y micrófono.

---

## Guía de Uso

### Dashboard
1. Selecciona el día que deseas practicar desde el calendario lateral
2. Revisa los ejercicios programados y su duración
3. Haz clic en **"ENTRAR AL ESTUDIO 🎸"**

### Estudio en Vivo
1. Selecciona tu cámara y micrófono preferidos
2. Activa el **metrónomo** si lo necesitas (BPM configurable)
3. Presiona **"Iniciar Ejercicio"** para comenzar a grabar
4. El overlay muestra tu progreso en tiempo real
5. Presiona **"Siguiente Ejercicio"** cuando termines uno
6. Al completar todos, presiona **"Terminar Día"**

### Resumen y Descarga
1. Revisa tu video en el reproductor integrado
2. Verifica métricas: fecha, tiempo total, ejercicios completados
3. Descarga el video compilado y los datos JSON de segmentos
4. Regresa al dashboard para continuar con otro día

### Configurar Rutina
1. Click en **"⚙️ Configurar"** en el header
2. Usa el **Editor Visual** para modificar días y ejercicios
3. O edita el JSON directamente si prefieres control total
4. Guarda cambios para actualizar tu plan de práctica

---

## API de Configuración

### Formato de `routine.json`

```json
{
  "routineName": "Nombre del Plan",
  "days": [
    {
      "dayNumber": 1,
      "title": "Título del Día",
      "durationMinutes": 50,
      "exercises": [
        {
          "id": "unique_id",
          "name": "Nombre del Ejercicio",
          "duration": 720,
          "notes": "Instrucciones detalladas..."
        }
      ]
    }
  ]
}
```

### Campos de Ejercicio
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Identificador único |
| `name` | string | Nombre visible |
| `duration` | number | Duración en segundos |
| `notes` | string | Instrucciones detalladas |

---

## Casos de Uso

- **Músicos serius** que quieren documentar su progreso
- **Profesores** que diseñan planes de práctica para estudiantes
- **Autodidactas** que necesitan estructura y accountability
- **Streamers** que quieren contenido de práctica profesional
- **Grabadores caseros** que necesitan overlay broadcast

---

## Roadmap

- [ ] Soporte para múltiples instrumentos
- [ ] Integración con DAWs externos
- [ ] Modo de práctica sin grabación
- [ ] Exportación a formatos de video profesionales
- [ ] Panel de estadísticas y gráficos de progreso
- [ ] Modo competitivo con排行榜

---

## Licencia

MIT License - Libre para uso personal y comercial.

---

## Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría hacer.

---
