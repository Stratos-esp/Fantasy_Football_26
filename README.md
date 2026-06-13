# Fantasy

Fantasy privado de LaLiga para jugar con amigos, al estilo Comunio. Totalmente funcional: ligas privadas con código de invitación, plantillas aleatorias, alineaciones con capitán y banquillo, mercado con cuatro sistemas (pujas, precio fijo, cláusulas y traspasos directos), jornadas con puntos, evolución de valores, clasificación, chat de liga, administración, auditoría y reinicio de liga.

## Stack

- Next.js 16, React 19 y TypeScript
- Tailwind CSS 4 más un sistema visual propio con cuatro temas
- Supabase como PostgreSQL gestionado, sin Supabase Auth
- Autenticación propia con `scrypt`, sesiones revocables y cookies `HttpOnly`
- Vercel como destino de despliegue (con cron diario para resolver el mercado)

## Cómo se juega

1. Cada usuario se registra en `/login` (usuario o correo + contraseña).
2. Un usuario crea la liga y comparte el **código de invitación**; el resto se une con él.
3. Al entrar en una liga, cada mánager recibe una **plantilla aleatoria** de 15 jugadores (2 POR, 5 DEF, 5 MED, 3 DEL) con valor equilibrado, y el resto del presupuesto (100 M€ totales) queda como saldo.
4. En **Mi plantilla** se elige formación, titulares, banquillo (con sustituciones automáticas) y capitán.
5. En **Mercado** hay subastas diarias de la liga (pujas ocultas), ventas a precio fijo entre miembros, cláusulas de rescisión y ofertas directas.
6. El administrador **disputa la jornada** (sección Jornada o Administración): se generan los puntos de todos los jugadores, se actualizan la clasificación y los valores de mercado.
7. En **Ajustes**, el administrador puede cambiar las reglas y **reiniciar la liga** (nuevas plantillas aleatorias para todos, puntos y mercado a cero).

## Datos de jugadores

Los 20 equipos y ~300 jugadores de LaLiga 2025/26 viven en `src/lib/laliga-data.ts` y se cargan con:

```text
POST /api/cron/seed-laliga
Authorization: Bearer <CRON_SECRET>
```

Las jornadas se simulan internamente con un modelo estadístico (minutos, goles, asistencias, porterías a cero, tarjetas...) y las reglas de puntuación de `src/lib/scoring.ts`. El adaptador de API-Football (`/api/cron/sync-players`) queda preparado por si en el futuro se contrata un plan con datos de la temporada actual: los planes gratuitos no incluyen estadísticas de jugador de la temporada en curso.

## Desarrollo local

```bash
npm install
copy .env.example .env.local   # y rellena las variables
npm run dev
```

## Base de datos

Usa el proyecto Supabase dedicado `Fantasy_Football_26` (`zrcijagotagaudmkywjx`). Todos los objetos usan el prefijo `fantasy_`. Las tablas tienen RLS y solo aceptan operaciones cuando el backend envía `FANTASY_DATABASE_API_SECRET` (verificado por hash en `private.fantasy_server_config`).

Para aplicar futuras migraciones:

```bash
npx supabase login
npx supabase link --project-ref zrcijagotagaudmkywjx
npx supabase db push
```

Para rotar el secreto del servidor: genera uno nuevo, actualiza `private.fantasy_server_config.secret_hash` con `extensions.digest('<secreto>', 'sha256')` y cambia la variable en Vercel.

## Despliegue

El proyecto `fantasy-football-26` de Vercel despliega en producción (https://fantasy-football-26.vercel.app). Variables necesarias: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FANTASY_DATABASE_API_SECRET`, `CRON_SECRET` y `NEXT_PUBLIC_APP_URL`. El cron diario (`vercel.json`) resuelve las subastas vencidas y repone el mercado.

## Estado actual

Aplicación completa y operativa en producción (https://fantasy-football-26.vercel.app). Base de datos migrada y poblada con los 20 equipos y ~300 jugadores de LaLiga 2025/26. El primer usuario que cree una liga queda como administrador.
