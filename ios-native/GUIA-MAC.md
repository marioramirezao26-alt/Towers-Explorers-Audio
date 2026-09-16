# Ver a Gaby corriendo (sesión en una Mac en la nube)

El objetivo de esta primera sesión es **ver a Gaby funcionando de verdad** en un
iPhone simulado y confirmar que habla con tu backend. No queda instalada en tu
teléfono todavía — eso es el paso siguiente, y está explicado al final.

**Por qué no en tu iPhone todavía:** una Mac en la nube no puede ver tu teléfono.
Tu iPhone está en tu casa y la Mac en un datacenter; el cable no llega. MacinCloud
solo permite conectar un iPhone físico en el plan Dedicado (con software extra de
pago), y ese plan suele estar agotado. La forma real de llegar al iPhone desde una
Mac remota es TestFlight, que pide la cuenta de desarrollador de pago — ver
"Después de esta sesión".

## Antes de encender el reloj (desde Windows, gratis)

1. **Ten a mano tus tres datos de Gaby:**
   - URL de `deviceCommand`, algo como
     `https://REGION-TU-PROYECTO.cloudfunctions.net/deviceCommand`
   - El `DEVICE_SHARED_SECRET` que configuraste con
     `firebase functions:secrets:set DEVICE_SHARED_SECRET`
   - El id de tu workspace (consola de Firebase → Firestore → colección
     `workspaces` → id del documento)

   Si el Stack-chan ya te funciona, son **los mismos tres valores** que tienes en
   `stackchan-firmware/src/secrets.h`.

2. **Confirma que el backend responde**, desde cualquier terminal en Windows:

   ```bash
   curl -X POST "TU-URL-DE-deviceCommand" -H "Content-Type: application/json" -H "x-device-secret: TU-SECRETO" -d "{\"workspaceId\":\"TU-WORKSPACE-ID\",\"message\":\"hola\"}"
   ```

   Si responde un texto de Gaby, listo. Si falla, arréglalo **antes** de pagar: es
   el mismo problema que verías en la app, pero con el reloj corriendo.

3. **Si usas la prueba gratis de 24 horas** (plan Servidor Administrado): anota
   recordarte cancelarla antes de que se convierta en 25 USD/mes. Con el plan de
   pago por uso (4 USD/día) no tienes ese riesgo.

## En la Mac (aquí corre el reloj)

Te conectas por RDP (Escritorio Remoto de Windows) con los datos que te manda
MacinCloud por correo.

### 1. Traer el proyecto

Abre **Terminal** en la Mac y pega:

```bash
git clone https://github.com/marioramirezao26-alt/Towers-Explorers-Audio.git
cd Towers-Explorers-Audio
git checkout claude/asistente-citas-notas-voz-q9kmim
cd ios-native
cp Scowld/Core/Secrets.swift.example Scowld/Core/Secrets.swift
open Scowld.xcodeproj
```

La primera vez, Xcode se toma varios minutos descargando las dependencias
(abajo a la derecha dice "Resolving Package Dependencies"). Es normal; espera a
que termine antes de seguir.

### 2. Poner tus datos

En Xcode, panel izquierdo → `Scowld` → `Core` → `Secrets.swift`. Completa los tres
valores del paso 1. Ese archivo está en `.gitignore`: nunca se sube a git.

### 3. Correrla

1. Arriba, junto al botón ▶, haz clic donde dice el dispositivo y elige un
   simulador de iPhone (por ejemplo **iPhone 16**).
2. Presiona **▶ (Run)**.

**No necesitas firmar ni poner tu Apple ID** para el simulador. Si Xcode se queja
de firma, es porque quedó seleccionado un iPhone físico en vez de un simulador.

### 4. Qué revisar

Lo que **sí** puedes comprobar en el simulador:

- Gaby aparece: la cara de puntos azules, girando, con los ojos brillando.
- Le escribes un mensaje y responde → tu backend está conectado.
- Le pides algo real: *"agéndame una cita mañana a las 3"*. Luego abres
  `gaby-c76cf.web.app` y verificas que la cita **también esté ahí**. Si aparece en
  los dos lados, la app y la web comparten el mismo cerebro — que es todo el punto
  del diseño.

Lo que **no** funciona en un simulador (y no significa que esté roto):

- El micrófono y la voz: el simulador usa el micrófono de la Mac remota, y el
  audio normalmente no viaja por RDP. Prueba escribiendo en vez de hablando.
- La cámara: el simulador no tiene.

### 5. Antes de cerrar la sesión

Si algo falló, copia el error tal cual de la consola de Xcode (menú **View →
Debug Area → Activate Console**) y mándamelo. Con eso lo corrijo sin necesidad de
otra sesión de Mac.

## Si algo falla

- **Xcode pide un equipo de firma** → tienes seleccionado un iPhone físico.
  Cambia a un simulador.
- **Se queda en "Resolving Package Dependencies"** → dale tiempo; la primera vez
  baja bastante. Si de plano falla, en Terminal:
  `cd ~/Towers-Explorers-Audio/ios-native && xcodebuild -resolvePackageDependencies -project Scowld.xcodeproj`
- **Abre pero Gaby no responde** → casi siempre es `Secrets.swift`: revisa que la
  URL no tenga espacios y que el secreto sea idéntico al de Firebase. Corre el
  mismo `curl` del paso 2 desde la Terminal de la Mac para descartarlo.
- **Se cierra sola al abrir** → el error real sale en la consola de Xcode.

## Qué NO hace falta hacer en la Mac

Ya está resuelto y verificado: GitHub Actions compila este proyecto en una Mac
real en cada cambio, así que el código Swift, las dependencias y la cara 3D de
Gaby ya están comprobados. Esta sesión es para **verla correr**, no para programar.

## Después de esta sesión: tenerla en tu iPhone

Si en el simulador todo funciona, hay dos caminos para llegar a tu teléfono real:

- **TestFlight (recomendado).** Requiere el Apple Developer Program (99 USD/año).
  Desde la misma Mac en la nube: Archive → subir a App Store Connect → instalas
  en tu iPhone por internet, sin cable. Dura **1 año** y la puedes compartir con
  tu familia.
- **Una Mac prestada un rato.** Gratis, con un Apple ID normal y cable. La
  limitación es que la app **caduca cada 7 días** y toca reconectarla a esa Mac.
