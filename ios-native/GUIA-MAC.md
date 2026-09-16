# Instalar Gaby en tu iPhone (sesión en una Mac)

Guía para seguir de corrido en una Mac (propia, prestada o alquilada por hora).
El objetivo de la sesión es uno solo: **que Gaby quede instalada y funcionando en
tu iPhone**. Todo lo que se puede dejar listo de antemano ya está listo.

## Antes de encender el reloj (hazlo desde Windows, gratis)

Esto no requiere Mac y te ahorra tiempo pagado:

1. **Ten a mano tus tres datos de Gaby** (los vas a escribir en la Mac):
   - La URL de `deviceCommand`. La ves en la consola de Firebase, o corriendo
     `firebase deploy --only functions`. Se ve así:
     `https://REGION-TU-PROYECTO.cloudfunctions.net/deviceCommand`
   - El `DEVICE_SHARED_SECRET` que configuraste con
     `firebase functions:secrets:set DEVICE_SHARED_SECRET`
   - El id de tu workspace (consola de Firebase → Firestore → colección
     `workspaces` → el id del documento).

   Si el Stack-chan ya te funciona, son **exactamente los mismos tres valores**
   que están en `stackchan-firmware/src/secrets.h`.

2. **Confirma que `deviceCommand` responde.** Desde cualquier terminal:

   ```bash
   curl -X POST "TU-URL-DE-deviceCommand" \
     -H "Content-Type: application/json" \
     -H "x-device-secret: TU-SECRETO" \
     -d '{"workspaceId":"TU-WORKSPACE-ID","message":"hola"}'
   ```

   Si te responde un texto de Gaby, el backend está listo. Si falla, resuélvelo
   **antes** de pagar la Mac: es el mismo problema en el iPhone y ahí sale más caro.

3. **Ten tu Apple ID a mano** (el mismo de tu iPhone) y el cable para conectarlo.

## Cuenta de Apple: cuál necesitas

Esta app **no usa capacidades de pago** (sin notificaciones push, sin iCloud),
así que un **Apple ID gratuito alcanza**. La diferencia:

| | Apple ID gratis | Apple Developer Program (99 USD/año) |
|---|---|---|
| Instalar en tu iPhone | Sí | Sí |
| Cuánto dura instalada | **7 días**, luego hay que reinstalar | 1 año |
| Costo | 0 | 99 USD/año |

Empieza con el gratuito. Si Gaby te resulta útil en el día a día y te cansa
reinstalarla cada semana, ahí pagas el programa.

## En la Mac (aquí corre el reloj)

### 1. Abrir el proyecto

```bash
git clone https://github.com/marioramirezao26-alt/Towers-Explorers-Audio.git
cd Towers-Explorers-Audio
git checkout claude/asistente-citas-notas-voz-q9kmim
cd ios-native
cp Scowld/Core/Secrets.swift.example Scowld/Core/Secrets.swift
open Scowld.xcodeproj
```

### 2. Poner tus datos

En Xcode, abre `Scowld/Core/Secrets.swift` y completa los tres valores del paso 1.
Ese archivo está en `.gitignore`: nunca se sube con tus datos reales.

### 3. Firmar con tu cuenta

1. Xcode → menú **Xcode → Settings → Accounts → +** → inicia sesión con tu Apple ID.
2. Selecciona el proyecto **Scowld** en el panel izquierdo → pestaña
   **Signing & Capabilities**.
3. Marca **Automatically manage signing**.
4. En **Team**, elige tu nombre (aparece como "Tu Nombre (Personal Team)").

Si dice que el bundle identifier ya está en uso, cámbialo por algo único tuyo:
`com.TUNOMBRE.gaby`.

### 4. Instalar en el iPhone

1. Conecta el iPhone por cable y desbloquéalo. Si pregunta, dale **Confiar**.
2. Arriba en Xcode, donde dice el dispositivo, elige tu iPhone (no un simulador).
3. Presiona **▶ (Run)**.
4. La primera vez el iPhone va a rechazar la app por ser de un desarrollador
   desconocido. En el iPhone: **Ajustes → General → VPN y gestión de dispositivos
   → tu Apple ID → Confiar**. Vuelve a presionar ▶.

### 5. Probar que funciona de verdad

- Se abre y ves la cara de Gaby (puntos azules brillantes, gira sola).
- Le hablas y te responde → significa que `deviceCommand` está conectado.
- Pídele algo real: *"agéndame una cita mañana a las 3"* y revisa que aparezca
  también en la web. Si aparece en los dos lados, la app y la web están
  compartiendo el mismo cerebro, que es todo el punto.

## Si algo falla

- **"Unable to install" / "device not registered"** → el iPhone no está en tu
  cuenta todavía. Xcode lo registra solo; acepta los diálogos y reintenta.
- **La app abre pero Gaby no responde** → casi siempre es `Secrets.swift`:
  revisa que la URL no tenga espacios y que el secreto sea idéntico al de
  Firebase. El mismo `curl` del paso 2, corrido desde la Mac, te lo confirma.
- **Se cierra sola al abrir** → en Xcode, menú **View → Debug Area → Activate
  Console**: ahí sale el error real. Cópialo tal cual para diagnosticarlo.

## Qué NO hace falta hacer en la Mac

Ya está resuelto y verificado en CI (GitHub Actions compila este proyecto en una
Mac en cada cambio):

- Que el código Swift compile.
- Las dependencias (swift-realtime-openai y las suyas).
- La cara 3D de Gaby, incluida dentro de la app y sin necesidad de internet.

Es decir: la sesión de Mac es para **firmar e instalar**, no para programar.
