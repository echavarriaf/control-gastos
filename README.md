# Presupuesto Felo · Control de gastos

Aplicación privada de presupuesto con ingresos recurrentes y manuales, compromisos fijos, gastos variables, tarjetas de crédito y una cuenta bancaria operativa. Cada usuario administra sus propios datos y necesita autorización para entrar.

Construida con Next.js 16, React 19, TypeScript, Tailwind CSS 4, Firebase Authentication, Firestore y Firebase Cloud Messaging. Las versiones y comandos exactos están en [package.json](package.json).

## Requisitos

- Node.js 22 o superior y npm.
- Un proyecto Firebase con Authentication (proveedor Google) y Firestore habilitados.
- Una cuenta de servicio Firebase Admin para las rutas de cuenta bancaria, administración y notificaciones.
- Java 21 o superior para las pruebas de reglas con el emulador incluido en Firebase CLI.
- JavaScript y almacenamiento del sitio habilitados en el navegador.

## Instalación

```bash
npm ci
cp .env.example .env.local
```

Completa `.env.local` en la raíz con los valores de tu proyecto. Reinicia el servidor después de modificarlo. Las variables `NEXT_PUBLIC_*` se incorporan al código del navegador durante el build.

| Variables | Uso |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Configuración Firebase del navegador. El arranque valida su presencia. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket del proyecto. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Clave pública Web Push para registrar notificaciones. |
| `NEXT_PUBLIC_APP_URL` | Origen de la aplicación, por ejemplo `http://localhost:3000`; usado por las comprobaciones de origen en rutas protegidas. |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Credenciales exclusivas del servidor. La clave privada admite saltos de línea escapados como `\n`. |
| `CRON_SECRET` | Secreto que autentica la evaluación automática de alertas. |

No publiques `.env.local` ni credenciales Admin. [.env.example](.env.example) contiene únicamente campos de ejemplo.

Configura `localhost` y los dominios de despliegue como dominios autorizados en Firebase Authentication. Se usa acceso con Google mediante popup, con redirección como alternativa cuando el navegador bloquea la ventana.

Si utilizas otro proyecto Firebase, revisa también la configuración explícita de [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js) y el destino `/__/auth/:path*` de [vercel.json](vercel.json): no se obtienen automáticamente de `.env.local`.

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El servidor local utiliza el proyecto Firebase configurado: **no conecta automáticamente la aplicación al emulador**. Las pruebas de reglas sí utilizan un proyecto demo separado.

## Acceso y administración

1. Inicia sesión con Google. Si la cuenta aún no está autorizada, se crea una solicitud en `accessRequests/{uid}`.
2. Para entrar debe existir `allowedUsers/{uid}` con `activo: true`. El rol administrativo es `admin`; el normal es `usuario`.
3. Un administrador puede revisar solicitudes y administrar usuarios desde `/admin/usuarios`. Las API verifican el token, su revocación y el rol almacenado en Firestore.

Para el primer administrador, crea o autoriza primero su documento en `allowedUsers` desde un entorno de confianza. Después puedes inspeccionar la promoción con:

```bash
node --env-file=.env.local scripts/set-admin-role.mjs UID
```

Sin `--execute`, el script muestra los cambios previstos. Añade esa opción únicamente cuando quieras aplicar la promoción. Iniciar sesión con Google no concede autorización automáticamente.

## Modelo financiero

- **Cuenta de gastos:** representa efectivo bancario. Parte de un saldo inicial y su fecha; incluye depósitos, gastos bancarios, pagos fijos bancarios, pagos reales a tarjetas y movimientos manuales.
- **Recalibración:** conserva identificadores de movimientos ya incluidos en la fotografía del saldo para evitar contabilizarlos nuevamente. Los registros históricos se conservan.
- **Tarjetas:** una compra contabilizada aumenta deuda sin descontar inmediatamente efectivo del banco. Un pago real a tarjeta reduce deuda y efectivo.
- **Compras pendientes:** se muestran por separado y no afectan el saldo oficial ni la reserva bancaria hasta contabilizarse. Las compras históricas de tarjeta sin `estadoTarjeta` se interpretan como contabilizadas.
- **Disponible real:** `saldoActual - totalComprometido`, donde `totalComprometido = reservasFijas + tarjetasReservadas - solapamiento`. Las reservas respetan la quincena presupuestaria y las ventanas de pago de tarjetas; no equivalen a toda la deuda existente.
- **Pagos fijos parciales:** mantienen la reserva completa del compromiso hasta completarlo. El solapamiento evita reservar dos veces lo que también corresponda a una tarjeta.

La recalibración lee la cuenta y las cinco colecciones de movimientos dentro de una transacción de Firestore. El saldo base y sus listas se confirman juntos o no se guarda ninguno. Las cuentas antiguas que necesitan completar esas listas también se actualizan dentro de una transacción, para que una lectura no sobrescriba una recalibración concurrente. Si coinciden dos recalibraciones, se procesan como operaciones completas; la que se confirme al final determina la fotografía vigente.

Las reglas de negocio y compatibilidad se detallan en [AGENTS.md](AGENTS.md). Los cálculos principales están en `src/lib/budget/` y los resúmenes de tarjetas en `src/hooks/useCreditCardSummaries.ts`.

## Organización

```text
src/app/                  Páginas y API de Next.js
src/components/auth/      Acceso y autorización
src/components/admin/     Administración de usuarios
src/components/budget/    Interfaz del presupuesto
src/contexts/             Estado de autenticación
src/hooks/                Suscripciones, operaciones y resúmenes
src/lib/budget/           Tipos, normalización y cálculos financieros
src/lib/firestore/        Rutas por usuario y pruebas de reglas
src/lib/push/             Evaluación y envío de alertas del servidor
scripts/                  Administración y mantenimiento explícito
public/                   Recursos y service worker de notificaciones
firestore.rules           Validación y aislamiento de datos
```

Los documentos financieros residen bajo `users/{uid}/`: `gastos`, `pagosTarjeta`, `pagosFijos`, `compromisosFijos`, `tarjetasCredito`, `categoriasTarjeta`, `ingresos`, `movimientosCuenta`, `configuracion` y `cuentas`. Los dispositivos y estados de alertas también pertenecen al usuario. El SDK cliente construye las rutas privadas mediante `src/lib/firestore/user-paths.ts`.

Firebase Admin omite las reglas de Firestore; sus rutas deben autenticar y autorizar cada solicitud. La configuración de la cuenta se gestiona desde `/api/account/expense`.

### Separación de responsabilidades

| Área | Implementación |
| --- | --- |
| Tarjetas: cálculo puro | `src/lib/budget/credit-cards/`: tipos, línea de tiempo, cobertura del corte, resumen individual y totales. No depende de React, Firestore ni FCM. |
| Tarjetas: ciclo de React | `src/hooks/useCreditCardSummaries.ts`: reloj financiero y memoización. Mantiene sus exportaciones anteriores por compatibilidad. |
| Cuenta bancaria | `src/lib/budget/expense-account/`: validación y normalización, reservas y solapamiento, ledger y resumen. `expense-account.ts` conserva la API pública. |
| Push: coordinación | `src/lib/push/evaluate-user-alerts.ts`: carga datos, prepara alertas y coordina entrega y confirmación. |
| Push: acceso a datos | `repository.ts`: lecturas de Firestore, normalización y desactivación de instalaciones. |
| Push: cálculos | `card-calculations.ts`, `dates.ts` y `utils.ts`: cálculos y formatos sin acceso a Firestore ni FCM. |
| Push: estado transaccional | `budget-alert-state.ts`, `card-alert-state.ts` y `delivery-state.ts`: deduplicación, reservas de entrega y reintentos. |
| Push: entrega | `payloads.ts` construye los mensajes; `delivery.ts` los envía por lotes mediante FCM. |

Las implementaciones internas importan sus módulos concretos; las fachadas públicas permiten conservar los consumidores existentes. El cálculo del dashboard y el cálculo de recordatorios siguen siendo implementaciones separadas: esta reorganización no unifica ni cambia sus reglas financieras.

## Comprobaciones

### Carga de datos financieros

El dashboard consulta los movimientos manuales y los depósitos desde la fecha del saldo inicial de la cuenta. En ingresos se filtra por **fecha recibida**, para conservar depósitos programados antes de la recalibración pero cobrados después. El ciclo actual y el abierto en el modal se escuchan por ID, incluso cuando están proyectados y todavía no tienen fecha recibida. Si un ingreso aparece en ambas fuentes, se combina por ID para no sumarlo dos veces.

El administrador de depósitos monta su historial completo al abrir el panel y libera sus suscripciones al cerrarlo. La recalibración del servidor consulta únicamente movimientos hasta el día de su fotografía, incluyendo timestamps de ese mismo día, dentro de la transacción existente.

Los filtros son por fechas financieras y no requieren índices compuestos nuevos. No se aplican límites arbitrarios a las listas que calculan dinero: los gastos siguen necesitando historia para el arrastre quincenal y los movimientos de tarjetas para sus saldos. Esta optimización reduce lecturas de ingresos y movimientos manuales antiguos; no convierte todos los historiales en consultas de tamaño constante.

### Validación de fechas

Las reglas validan las fechas de gastos, pagos, configuraciones, ingresos y solicitudes de acceso. Los campos de texto que antes solo comprobaban longitud aceptan `YYYY-MM-DD` o una fecha ISO con hora y zona (`Z` o un desplazamiento como `-04:00`), con hasta nueve decimales opcionales en los segundos. Se comprueban días reales, años bisiestos y rangos de hora, minuto y segundo. Las fechas exclusivamente de calendario siguen usando su validador específico y las marcas nativas de Firestore conservan el tipo `timestamp`.

La comprobación reutiliza la fecha calendario para la parte anterior a `T` y valida el resto con una expresión regular, mediante las operaciones de [String de Firebase Security Rules](https://firebase.google.com/docs/reference/rules/rules.String). Se aplica a las nuevas escrituras y actualizaciones; no convierte ni modifica documentos históricos automáticamente.

### Comandos

| Comando | Función |
| --- | --- |
| `npm run lint` | ESLint sobre el proyecto. |
| `npm test` | Pruebas unitarias y de componentes con Vitest, excluyendo reglas. |
| `npm run test:watch` | Pruebas unitarias en modo observación. |
| `npm run test:rules` | Arranca el emulador, prueba reglas y consistencia transaccional de la cuenta, y lo detiene. |
| `npm run test:all` | Ejecuta pruebas unitarias y de reglas. |
| `npm run build` | Compila y comprueba tipos para producción. |
| `npm run start` | Sirve el build de producción. |

Las pruebas de reglas usan `demo-presupuesto` y Firestore en `127.0.0.1:8080`. El emulador también necesita sus puertos auxiliares libres y puede descargar su binario la primera vez. No despliegan reglas ni modifican el proyecto Firebase real.

Las pruebas de evaluación push también se ejecutan con `npm run test:rules`: usan Firestore emulado y mensajería simulada, sin enviar notificaciones reales. Cubren deduplicación, dispositivos inválidos, reintentos y ventanas de pago. Los tests y sus fixtures sintéticos se versionan junto con el código; credenciales, logs y resultados generados permanecen fuera de Git.

Hay excepciones locales documentadas a `react-hooks/set-state-in-effect` en cargas iniciales y reinicios de datos por sesión. La regla sigue activa donde no existe una excepción local o una configuración previa en `eslint.config.mjs`.

## Despliegue

El repositorio incluye configuración para Vercel. Configura allí las variables de entorno, la URL pública y los dominios autorizados de Firebase antes de desplegar. Las variables públicas requieren un nuevo build para que cambien en el navegador.

`vercel.json` programa `/api/cron/push-evaluate` diariamente a las **12:00 UTC**. La ruta exige `Authorization: Bearer <CRON_SECRET>` y evalúa usuarios activos con concurrencia limitada. El registro push requiere soporte del navegador, permiso del usuario, VAPID y un contexto seguro; su compatibilidad varía según navegador y dispositivo.

El despliegue de Next.js no publica las reglas de Firestore. Después de comprobarlas, su publicación es una operación independiente:

```bash
npx firebase deploy --only firestore:rules --project TU_PROJECT_ID
```

Revisa el proyecto destino antes de ejecutar el comando.

## Mantenimiento

Los scripts requieren las credenciales Admin de `.env.local` y un UID explícito. Por defecto trabajan en modo simulación:

```bash
node --env-file=.env.local scripts/set-admin-role.mjs UID
node --env-file=.env.local scripts/migrate-budget-to-user.mjs UID
node --env-file=.env.local scripts/repair-legacy-fixed-commitments.mjs UID
```

- `set-admin-role.mjs`: promueve una cuenta previamente autorizada a administrador.
- `migrate-budget-to-user.mjs`: copia datos globales legacy al espacio privado del usuario, conservando IDs y colecciones de origen.
- `repair-legacy-fixed-commitments.mjs`: repara compromisos legacy; admite `--referenced-only` para limitarse a los referenciados por pagos históricos.

`--execute` aplica escrituras. Los dos scripts de datos admiten `--overwrite` para sobrescribir documentos existentes. Revisa la simulación y respalda los datos antes de aplicar cambios; estos scripts no forman parte del arranque normal.

## Problemas de acceso en Safari

Si la pantalla permanece en «Verificando acceso»:

1. Comprueba **Safari → Configuración → Seguridad → Activar JavaScript**. Si está desactivado, la página muestra un aviso específico.
2. Prueba una ventana privada. Si funciona allí, revisa extensiones, bloqueadores y datos guardados del perfil normal.
3. Si eliminas los datos de `localhost` desde **Privacidad → Administrar datos de sitios web**, se cerrará la sesión de ese sitio. Cierra sus pestañas y vuelve a abrirlo.
4. En desarrollo, la consola del navegador muestra pasos con el prefijo `[Acceso ...]`. Los efectos de autenticación se ejecutan en el navegador; los logs de render en la terminal no confirman que se hayan ejecutado allí.

Las consultas de acceso tienen límite de espera y permiten reintentar cuando fallan. Estos límites no conceden acceso sin verificar permisos.
