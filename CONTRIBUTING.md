# Guía de colaboración

## Flujo de trabajo

1. Actualiza `main` antes de comenzar.
2. Crea una rama corta desde `main`, por ejemplo `feat/mercado` o
   `fix/alineacion-movil`.
3. Haz commits pequeños y con una descripción clara.
4. Actualiza `CHANGELOG.md` si el cambio afecta al producto, la base de datos o
   el despliegue.
5. Abre un pull request y espera al menos una revisión antes de fusionarlo.
6. Evita trabajar directamente sobre `main`.

## Comprobaciones

Antes de abrir un pull request ejecuta:

```bash
npm run typecheck
npm run build
```

Explica en el pull request cualquier comprobación que no se haya podido
ejecutar.

## Pull requests

Cada pull request debe indicar:

- Qué cambia y por qué.
- Como se ha probado.
- Si necesita una migración de Supabase o nuevas variables de entorno.
- Capturas para cambios visuales relevantes.
- La entrada correspondiente en `CHANGELOG.md`, cuando aplique.

## Base de datos y secretos

- Crea una migración nueva para cada cambio de esquema; no edites migraciones
  ya aplicadas.
- No subas `.env.local`, claves, tokens, cookies ni datos personales.
- Documenta variables nuevas en `.env.example` sin incluir valores reales.
- Coordina las migraciones y el despliegue con la persona responsable del
  entorno antes de fusionar.

## Convenciones recomendadas

- `feat:` nueva funcionalidad.
- `fix:` corrección de un error.
- `style:` cambio visual sin alterar la lógica.
- `docs:` documentación.
- `refactor:` reorganización sin cambio funcional esperado.
- `chore:` mantenimiento interno.
