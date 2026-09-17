# Instalar Gaby en tu iPhone (con una MacBook prestada)

Esta es la ruta buena: con una MacBook física, un cable y tu Apple ID normal,
Gaby queda instalada en tu iPhone **hoy y sin pagar nada**.

## Lo primero, apenas tengas la MacBook

**Pon Xcode a descargar de una vez** (App Store → buscar "Xcode" → Obtener).
Pesa entre 10 y 15 GB y es lo único que puede alargar la sesión. Que baje
mientras haces el resto.

### Antes, revisa que sirva

En la MacBook: menú  → "Acerca de esta Mac".

- **macOS Sonoma 14.5 o más nuevo** → todo bien.
- **Más viejo** → no podrá instalar Xcode 16, que es el mínimo que necesita este
  proyecto. Tocaría actualizar macOS primero (también tarda). Si la MacBook es
  muy antigua y no admite la actualización, esa Mac no sirve para esto.

## Lo que debes tener a mano

Tus tres datos de Gaby, que vas a escribir en la Mac:

- URL de `deviceCommand`, algo como
  `https://REGION-TU-PROYECTO.cloudfunctions.net/deviceCommand`
- El `DEVICE_SHARED_SECRET` que configuraste con
  `firebase functions:secrets:set DEVICE_SHARED_SECRET`
- El id de tu workspace (consola de Firebase → Firestore → colección
  `workspaces` → id del documento)

Si el Stack-chan ya te funciona, son **los mismos tres valores** que están en
`stackchan-firmware/src/secrets.h`.

Y confirma desde Windows, antes de empezar, que el backend responde:

```bash
curl -X POST "TU-URL-DE-deviceCommand" -H "Content-Type: application/json" -H "x-device-secret: TU-SECRETO" -d "{\"workspaceId\":\"TU-WORKSPACE-ID\",\"message\":\"hola\"}"
```

Si responde un texto de Gaby, listo. Si falla, arréglalo antes: es el mismo
problema que verías en el teléfono.

> **Importante:** despliega primero las funciones (`firebase deploy --only
> functions`). El router que entiende "agéndame", "cancélame" y "qué tengo hoy"
> es nuevo y vive en el servidor; sin desplegarlo, Gaby conversa pero no agenda.

## Tu cuenta de Apple: la gratis alcanza

Esta app no usa capacidades de pago (sin notificaciones push, sin iCloud), así
que **tu Apple ID normal sirve**. La única diferencia:

| | Apple ID gratis | Apple Developer (99 USD/año) |
|---|---|---|
| Instalar en tu iPhone | Sí | Sí |
| Cuánto dura | **7 días**, luego se reinstala | 1 año |
| Costo | 0 | 99 USD/año |

Empieza con la gratis. Si Gaby te resulta útil a diario y te cansa reinstalarla
cada semana, ahí decides pagar.

## Los pasos

### 1. Traer el proyecto

Abre **Terminal** en la MacBook y pega:

```bash
git clone https://github.com/marioramirezao26-alt/Towers-Explorers-Audio.git
cd Towers-Explorers-Audio
git checkout claude/asistente-citas-notas-voz-q9kmim
cd ios-native
cp Scowld/Core/Secrets.swift.example Scowld/Core/Secrets.swift
open Scowld.xcodeproj
```

La primera vez Xcode tarda varios minutos bajando dependencias (abajo a la
derecha: "Resolving Package Dependencies"). Espera a que termine.

### 2. Poner tus datos

En Xcode, panel izquierdo → `Scowld` → `Core` → `Secrets.swift`. Completa los
tres valores. Ese archivo está en `.gitignore`: nunca se sube a git.

### 3. Firmar con tu cuenta

1. Menú **Xcode → Settings → Accounts → +** → inicia sesión con tu Apple ID.
2. Selecciona el proyecto **Scowld** → pestaña **Signing & Capabilities**.
3. Marca **Automatically manage signing**.
4. En **Team**, elige tu nombre ("Tu Nombre (Personal Team)").

Si dice que el identificador ya está en uso, cámbialo por algo único tuyo:
`com.TUNOMBRE.gaby`.

### 4. Instalar en el iPhone

1. Conecta el iPhone por cable y desbloquéalo. Si pregunta, dale **Confiar**.
2. Arriba en Xcode, donde dice el dispositivo, **elige tu iPhone** (no un
   simulador — si dejas un simulador, no se instala en el teléfono).
3. Presiona **▶ (Run)**.
4. La primera vez el iPhone rechaza la app por venir de un desarrollador
   desconocido. En el iPhone: **Ajustes → General → VPN y gestión de
   dispositivos → tu Apple ID → Confiar**. Vuelve a presionar ▶.

### 5. Probar que de verdad funciona

- Se abre y ves el orbe azul de Gaby, girando.
- **Háblale.** En el teléfono real sí funciona el micrófono (en un simulador no).
- Pídele algo concreto: *"agéndame una cita con el dentista mañana a las 3 de la
  tarde"*. Luego ábrelo en `gaby-c76cf.web.app`: si la cita aparece también ahí,
  quedó demostrado que la app y la web comparten el mismo cerebro.
- Prueba también *"qué tengo hoy"* y *"cancélame la cita del dentista"*.

### 6. Antes de devolver la MacBook

La app dura 7 días y luego deja de abrir. Para renovarla necesitas esa Mac otra
vez, así que si es prestada, considera si te conviene:

- Pagar los 99 USD y subirla a **TestFlight** desde esa misma sesión: te dura un
  año, se actualiza por internet y la puedes compartir con tu familia.
- O simplemente reinstalarla cuando vuelvas a tener una Mac a la mano.

## Si algo falla

- **Xcode no abre el proyecto / dice que es de una versión más nueva** → esa Mac
  tiene un Xcode viejo. Necesitas Xcode 16 o superior.
- **Pide un equipo de firma** → tienes seleccionado un simulador; cambia a tu
  iPhone (o al revés, según el paso).
- **"Unable to install" / "device not registered"** → Xcode registra el teléfono
  solo; acepta los diálogos y reintenta.
- **Abre pero Gaby no responde** → casi siempre es `Secrets.swift`: revisa que la
  URL no tenga espacios y que el secreto sea idéntico al de Firebase. Corre el
  `curl` de arriba desde la Terminal de la Mac para descartarlo.
- **Agenda mal o no agenda** → falta desplegar las funciones (ver arriba).
- **Se cierra sola** → el error real sale en la consola de Xcode (**View → Debug
  Area → Activate Console**). Cópialo y te lo diagnostico.

## Qué NO hace falta hacer en la Mac

GitHub Actions ya compila este proyecto en una Mac real en cada cambio, así que
el código Swift, las dependencias y el orbe 3D están verificados. La sesión con
la MacBook es para **firmar e instalar**, no para programar.
