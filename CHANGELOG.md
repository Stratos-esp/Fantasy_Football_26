# Historial de cambios

Este archivo recoge los cambios relevantes del proyecto. El equipo debe
actualizar la sección `Pendiente` en cada pull request que cambie el
comportamiento, la interfaz, la base de datos o el despliegue.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## Pendiente

### Añadido

- Documentación común para mantener el historial y coordinar contribuciones.
- Logo oficial de «Stratos League» (recortado y con fondo transparente) en el
  panel de la pantalla de acceso y en la barra lateral de la aplicación.
- Nueva pestaña «Jugadores»: base de datos de toda LaLiga con buscador y
  filtros por posición y equipo, y ficha individual con gráfico real de
  evolución del valor de mercado, puntos por jornada y estadísticas de la
  temporada (datos en vivo de LaLiga Fantasy).
- En «Mi plantilla», la convocatoria muestra la forma reciente (puntos de las
  últimas jornadas) de cada jugador además del cómputo global.
- Selector de jornada dentro de Clasificación para consultar los resultados de
  cada jornada disputada.
- Ajuste para que cada miembro pueda cambiar el nombre de su equipo desde
  Ajustes.
- Modal de rival desde Clasificación para ver alineación, plantilla completa,
  enviar ofertas y pagar cláusulas.
- La gráfica de evolución del valor de mercado (ficha de jugador) muestra ahora
  el valor mínimo y máximo del periodo y la fecha de inicio y fin, y es
  interactiva: al pasar el ratón o tocar la gráfica aparece el valor exacto y la
  fecha de ese punto.
- La gráfica de evolución del valor distingue la temporada actual de la
  anterior: el tramo de la temporada pasada se dibuja atenuado y a rayas, con
  una línea divisoria y una leyenda que indica a qué temporada pertenece cada
  parte.
- Indicador de carga global: cualquier acción que tarde (simular jornadas,
  vender, pujar, pagar cláusula, guardar ajustes…) muestra un símbolo de carga
  mientras se procesa y una confirmación con visto bueno al terminar.
- Nueva opción para invertir saldo y aumentar la cláusula de tus jugadores
  (relación 1:1): el dinero invertido se descuenta de tu saldo y blindar a un
  jugador encarece su cláusula para los rivales. Disponible desde el mercado y
  también desde Mi plantilla al seleccionar un jugador.
- En Mi plantilla, cuando un titular sale del equipo (venta, cláusula…) su
  hueco queda vacío pero seleccionable para colocar a otro jugador, en vez de
  desaparecer.
- La pestaña Jornada muestra mucha más información: posición en la jornada y en
  la general, puntos totales, mejor jornada, líder de la jornada, puntos del
  capitán, evolución por jornada y desglose de titulares y banquillo.
- Nuevo ajuste de liga para mostrar u ocultar el número de pujas de cada
  jugador del mercado.
- Nueva pestaña «Normas» (configurable por el administrador): penalización de
  puntos por cada hueco de titular sin alinear, penalización por terminar la
  jornada con saldo negativo y dinero ganado por cada punto de la jornada.
- La convocatoria muestra con etiquetas de color si cada jugador es titular,
  suplente o está sin convocar, y permite cambiar su rol (titular, banquillo o
  fuera) tanto desde la lista como desde el banquillo.
- Si te quitan un titular (venta, cláusula…) y tienes un suplente de su
  posición, el hueco se rellena automáticamente; si no hay recambio, queda
  vacío.
- Sistema de votación de normas: cualquier miembro puede proponer cambios de
  normas y reglas de la liga; se aprueban por mayoría de todos los miembros y se
  resuelven al alcanzar la mayoría, cuando han votado todos o cuando el
  administrador cierra la votación. Los cambios de reglas ya no se aplican
  directamente, sino a través de esta votación.
- Nueva norma configurable: límite de clausulazos al mismo jugador cada 24 horas
  (0 = sin límite).

### Cambiado

- El mercado se ve mucho mejor en móvil: las subastas pasan a tarjetas
  horizontales tipo lista (foto, nombre, precio y botón de pujar más claros) en
  lugar del bloque comprimido anterior.
- Se aumentaron las proporciones de tamaño en toda la app (tipografías, avatares
  de las listas y controles) para que todo se lea mejor, sobre todo en móvil.
- En el 4-4-2 (y demás formaciones) los jugadores de cada línea se reparten
  centrados: los dos delanteros dejan de quedar pegados a las bandas.
- Ya se puede guardar la alineación con menos de 11 titulares; cada hueco vacío
  resta los puntos configurados en Normas al disputar la jornada.
- Los retratos de jugadores se centran mejor dentro de los avatares circulares.
- La vista Mi plantilla usa un campo vertical de abajo a arriba para configurar
  la alineación.
- Los jugadores sin foto muestran iniciales dentro de un círculo de equipo.
- La pantalla de Inicio muestra el once en campo vertical.
- Las etiquetas de posición son más visibles en plantillas, banquillo y mercado.
- Los temas alternativos se suavizaron, con dos opciones oscuras más cómodas.
- Los jugadores del campo (alineación) son más grandes y legibles, y escalan de
  forma proporcional al tamaño del campo en pantallas pequeñas.

### Corregido

- Se repararon los nombres de usuarios que conservaban acentos dañados en la
  base de datos.
- La Clasificación ya no abre automáticamente una ventana emergente que no se
  podía cerrar; los resultados por jornada se consultan ahora desde la propia
  vista.
- Un jugador ya no puede aparecer en el mercado si ya pertenece a una plantilla:
  al cambiar de dueño se cancelan los anuncios y ofertas pendientes que tuviera.
- El logo de Stratos League en la barra lateral lleva a Inicio en lugar de salir
  de la aplicación.
- En Inicio, el once se coloca en posiciones fijas y ya no se descoloca cuando
  hay algún hueco libre en la plantilla.
- Con el banquillo desactivado, la convocatoria ya no muestra jugadores como
  «suplentes».

## 2026-06-15

### Cambiado

- La disposición del campo adapta avatares, escudos y etiquetas al tamaño real
  del contenedor.
- Se ampliaron los avatares y la separación vertical de los jugadores.
- Los retratos pasaron a un acabado sin borde con escudos transparentes mas
  visibles.

## 2026-06-13

### Añadido

- Campo de fútbol realista con líneas, círculo central, áreas y arcos.
- Vista de campo apaisada reutilizada en las distintas pantallas de alineación.
- Proyecto inicial de Fantasy Football 26 con Next.js 16 y Supabase.

### Cambiado

- Se añadieron franjas de césped y siluetas de jugadores a las vistas del
  campo.
- El README se actualizó con el proyecto dedicado de Supabase y el despliegue
  de producción.

## Como mantener este archivo

1. Añade cada cambio bajo `Pendiente` y en la categoría adecuada.
2. Describe el efecto para usuarios o colaboradores, no solo el archivo
   modificado.
3. Al preparar una versión, mueve las entradas a una sección con fecha
   `AAAA-MM-DD`.
4. No reescribas entradas publicadas salvo para corregir un error factual.
