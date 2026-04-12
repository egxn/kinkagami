# UI Library

Componentes de presentación reutilizables para el smart fitness mirror. Todos los componentes están desacoplados de la lógica de validación y detección de poses.

Los componentes se exportan desde `index.ts` y deben importarse desde `@/ui` o `../ui`.

---

## Componentes

### `Button`

Botón de interacción principal del sistema, diseñado para funcionar tanto con gestos de mano como con interacción convencional.

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Contenido del botón |
| `className` | `string` | — | Clase CSS adicional |
| `style` | `CSSProperties` | — | Estilos inline adicionales |
| `alignX` | `"auto" \| "left" \| "center"` | `"auto"` | Alineación del contenido |
| `mode` | `"default" \| "checkbox"` | `"default"` | Modo visual del botón |
| `checked` | `boolean` | `false` | Estado marcado (modo checkbox) |
| `isHovered` | `boolean` | `false` | Estado hover (controlado externamente por el sistema de gestos) |
| `isFocused` | `boolean` | `false` | Estado focus (controlado externamente por el sistema de gestos) |
| `isCameraLoading` | `boolean` | `false` | Muestra estado de carga de cámara |
| `isModelLoading` | `boolean` | `false` | Muestra estado de carga del modelo |
| `onClick` | `() => void` | — | Callback al hacer click o activar con teclado |

**Notas:**
- Cuando `alignX` es `"auto"`, el botón centra el contenido si solo contiene texto y lo alinea a la izquierda si tiene nodos compuestos.
- Soporta activación con teclado (`Enter` / `Space`).
- Las variables de color se definen con tokens CSS (`--kgm-button-*`).

---

### `CardLayout`

Layout de pantalla completa con carrusel de tarjetas, navegación por páginas y botones de acción en el footer. Es la estructura visual principal de las vistas de selección del mirror.

**Props principales:**

| Prop | Tipo | Descripción |
|------|------|-------------|
| `title` | `string` | Título de la sección |
| `loading` | `boolean` | Muestra estado de carga |
| `error` | `Error \| null` | Muestra mensaje de error |
| `isEmpty` | `boolean` | Muestra mensaje de lista vacía |
| `loadingMessage` | `string` | Texto durante carga |
| `emptyMessage` | `string` | Texto cuando no hay items |
| `errorPrefix` | `string` | Prefijo del mensaje de error |
| `onRetry` | `() => void` | Callback para reintentar tras error |
| `hasPrevious` / `hasNext` | `boolean` | Habilita botones de navegación |
| `onPrevious` / `onNext` | `() => void` | Callbacks de navegación |
| `slots` | `ReactNode[]` | Lista de tarjetas a renderizar |
| `actionSlots` | `ReactNode[]` | Slot de acciones debajo de cada tarjeta |
| `transitionDirection` | `"forward" \| "backward"` | Dirección de la animación de transición |
| `transitionKey` | `string \| number` | Key para forzar re-render en transición |
| `footerButtonLabel` | `string` | Texto del botón principal del footer |
| `footerButtonOnAction` | `() => void` | Acción confirmar del footer |
| `footerButtonOnDiscard` | `() => void` | Acción descartar del footer |
| `footerButtonDisabled` | `boolean` | Deshabilita el botón principal |
| `renderButton` | `(props) => ReactNode` | Render prop para inyectar el componente botón con soporte de gestos |

**Props de dimensionado opcionales:** `navSlotWidth`, `cardSlotFlex`, `slotMinHeight`, `actionSlotMinHeight`, `cardSlotHeightPercent`, `actionSlotHeightPercent`, `navButtonSize`, `footerButtonWidth`, `footerButtonMinHeight`.

**Notas:**
- El botón secundario del footer es opcional (`secondaryFooterButton*`).
- El `renderButton` render prop permite que la aplicación inyecte su implementación de botón con gestos sin que el layout dependa de ella.

---

### `DebugFSM`

Visualizador Canvas 2D del grafo de eventos (FSM) de un ejercicio. Útil durante desarrollo para inspeccionar los nodos, aristas y el progreso de reproducción.

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `exercise` | `Exercise` | — | Ejercicio cuyo `event_graph` se visualiza |
| `isPlaying` | `boolean` | `false` | Activa la animación de nodos visitados/activos |
| `progress` | `number` | `0` | Progreso de reproducción (0–1) |

**Notas:**
- Dibuja el grafo en layout vertical por capas (topológico).
- Nodos coloreados según rol: inicio, terminal, visitado, activo.
- Incluye controles de zoom y botón "Ajustar" para encuadre automático.
- Muestra los datos raw del grafo en un `<details>` desplegable.

---

### `DevInfoSnackbar`

Barra informativa superpuesta para desarrollo. Muestra el modelo de detección activo, fuente de cámara, backend de inferencia y FPS en tiempo real.

**Props:**

| Prop | Tipo | Descripción |
|------|------|-------------|
| `modelLabel` | `string` | Nombre del modelo de pose activo |
| `cameraLabel` | `string` | Identificador de la fuente de cámara |
| `backendLabel` | `string` | Backend de inferencia en uso |

**Notas:**
- El FPS se calcula con `requestAnimationFrame` sobre una ventana deslizante de 30 frames.
- El color del FPS cambia: verde (≥20), amarillo (≥10), rojo (<10).
- Puede ocultarse con el botón `×` (estado local, no persiste).

---

### `ExerciseCard`

Tarjeta de presentación de un ejercicio para uso en listas y carruseles de selección.

**Props:**

| Prop | Tipo | Descripción |
|------|------|-------------|
| `exercise` | `Exercise` | Datos del ejercicio |
| `isSelected` | `boolean` | Muestra indicador visual de selección |

**Muestra:**
- Nombre y descripción del ejercicio.
- Badge de dificultad, duración en segundos, y series × repeticiones.
- Tags de grupos musculares (máximo 3 visibles + contador de excedentes).

---

### `HandCursorOverlay`

Cursor visual que representa la posición de la mano detectada sobre la interfaz. Muestra un anillo de progreso para gestos de confirmación/descarte.

**Props:**

| Prop | Tipo | Descripción |
|------|------|-------------|
| `cursor` | `HandCursorState` | Estado completo del cursor de mano |

**`HandCursorState`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `visible` | `boolean` | Si el cursor debe mostrarse |
| `x` | `number` | Posición X en píxeles |
| `y` | `number` | Posición Y en píxeles |
| `lastEvent` | `"confirm" \| "discard" \| null` | Último evento de gesto detectado |
| `eventSequence` | `number` | Contador que cambia con cada nuevo evento |
| `gestureProgress` | `number` | Progreso del gesto actual (0–1), usado para el anillo |

**Notas:**
- La posición se aplica con `translate3d` para activar aceleración GPU.
- El pulso visual al confirmar/descartar dura 320 ms.
- Siempre tiene `aria-hidden="true"` ya que es decorativo.

---

### `RoutineCard`

Tarjeta de presentación de una rutina para uso en listas y carruseles de selección.

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `routine` | `Routine` | — | Datos de la rutina |
| `isSelected` | `boolean` | `false` | Muestra indicador visual de selección |

**Muestra:**
- Nombre y descripción de la rutina.
- Número de ejercicios y duración total en segundos.
- Tags de grupos musculares derivados de `routine.stats.muscleGroups` (máximo 3 + contador).

---

### `SelectableCard`

Contenedor genérico de tarjeta seleccionable. Envuelve cualquier contenido y añade estado visual de selección y un checkmark.

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `selected` | `boolean` | `false` | Aplica estilos de selección |
| `onClick` | `() => void` | — | Callback al hacer click |
| `onDoubleClick` | `() => void` | — | Callback al hacer doble click |
| `className` | `string` | — | Clase CSS adicional |
| `children` | `ReactNode` | — | Contenido de la tarjeta |

---

### `Skeleton`

Canvas 2D para renderizar el esqueleto de pose humana. Soporta dos modos: `centered` (pose grabada centrada) y `video` (pose sobre fotograma de vídeo en tiempo real).

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `variant` | `"centered" \| "video"` | `"centered"` | Modo de renderizado |
| `autoSize` | `boolean` | `false` | Ajusta el canvas al tamaño del contenedor con `ResizeObserver` |
| `width` | `number` | `640` | Ancho del canvas (px) |
| `height` | `number` | `480` | Alto del canvas (px) |
| `videoRef` | `RefObject<HTMLVideoElement>` | — | Referencia al elemento de vídeo (requerido en modo `video`) |
| `poses` | `Pose[]` | — | Lista de poses detectadas a dibujar |
| `angles` | `RecordingAngleEntry[]` | — | Ángulos articulares a superponer |
| `exercise` | `Exercise` | — | Ejercicio del que leer `recording_points` y `recording_angles` |
| `frameIndex` | `number` | `0` | Índice del frame grabado a mostrar (modo `centered`) |
| `opacity` | `number` | `1` | Opacidad global del canvas |
| `colors` | `SkeletonColors` | — | Colores personalizados para esqueleto y keypoints |
| `poseModel` | `PoseModelKind` | `"auto"` | Modelo de pose para seleccionar la topología de conexiones |
| `className` | `string` | — | Clase CSS adicional |

**Notas:**
- Utiliza `devicePixelRatio` para renderizado nítido en pantallas HiDPI.
- En modo `video`, dibuja el fotograma del vídeo con `fitMode: "cover"`.
- En modo `centered`, lee las poses grabadas del ejercicio si están disponibles.

---

### `VideoRangeSlider`

Slider de doble handle para seleccionar un rango de tiempo dentro de un vídeo. Soporta arrastre con mouse y touch.

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `duration` | `number` | — | Duración total del vídeo en segundos |
| `startTime` | `number` | — | Tiempo de inicio del rango seleccionado |
| `endTime` | `number` | — | Tiempo de fin del rango seleccionado |
| `onChange` | `(start: number, end: number) => void` | — | Callback al cambiar el rango |
| `disabled` | `boolean` | `false` | Deshabilita la interacción |

**Notas:**
- El rango mínimo entre `startTime` y `endTime` es 0.1 segundos.
- Los tiempos se muestran formateados como `M:SS.ms`.
- Escucha eventos en `window` durante el arrastre para no perder el handle.

---

### `VideoSelector`

Desplegable para seleccionar un vídeo de referencia de una lista de archivos disponibles.

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `videos` | `VideoFile[]` | — | Lista de vídeos disponibles |
| `loading` | `boolean` | `false` | Muestra mensaje de carga en el botón toggle |
| `onSelect` | `(videoUrl: string) => void` | — | Callback al seleccionar un vídeo |
| `currentUrl` | `string` | — | URL del vídeo actualmente seleccionado |

**`VideoFile`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | `string` | Nombre legible del archivo |
| `path` | `string` | Ruta/URL del vídeo |

**Notas:**
- Si `videos` está vacío, el componente no renderiza nada.
- El desplegable se cierra automáticamente al seleccionar un vídeo.
