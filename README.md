# Gaby

Tu "mano derecha" digital, compartida entre tú y tu socio, para el celular. Permite:

- 📅 **Agendar citas** en un espacio de trabajo compartido, con sincronización opcional a Google Calendar.
- 🎙️ **Grabar notas de voz** que se transcriben automáticamente a texto (usando Whisper de OpenAI).
- 🤝 **Trabajo en equipo**: tú y tu socio se unen al mismo espacio de trabajo con un código de invitación y ven todo en tiempo real.

App construida con **Expo (React Native)** + **Firebase** (Auth, Firestore, Storage, Cloud Functions).

## Estructura del proyecto

```
App.tsx                      punto de entrada
src/
  config/firebase.ts         inicialización de Firebase
  contexts/                  AuthContext, WorkspaceContext (estado global)
  hooks/useGoogleAuth.ts      login de Google para Calendar
  navigation/                React Navigation (stack + tabs)
  screens/
    auth/                    Login, Signup
    workspace/               Crear/unirse a espacio de trabajo
    home/                    Pantalla de inicio (código de invitación)
    appointments/            Lista y formulario de citas
    voicenotes/              Lista y grabación de notas de voz
  services/                  Firestore/Storage/Google Calendar (lógica de datos)
  types/                     Tipos TypeScript compartidos
functions/                   Cloud Function que transcribe el audio automáticamente
firestore.rules              Reglas de seguridad de Firestore
storage.rules                Reglas de seguridad de Storage
```

## 1. Requisitos previos

- Node.js 18+ y npm
- Una cuenta de [Firebase](https://console.firebase.google.com/)
- Una cuenta de [Google Cloud Console](https://console.cloud.google.com/) (para el login de Google Calendar; el mismo proyecto de Firebase ya cuenta como proyecto de Google Cloud)
- Una API key de [OpenAI](https://platform.openai.com/) (para transcribir las notas de voz con Whisper)
- La app [Expo Go](https://expo.dev/go) instalada en tu celular (para probar rápido) o [EAS CLI](https://docs.expo.dev/eas/) si luego quieres generar un `.apk`/`.ipa` instalable

## 2. Configurar Firebase

1. Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/).
2. **Authentication** → Sign-in method → habilita **Correo electrónico/contraseña**.
3. **Firestore Database** → créala en modo producción (las reglas ya están en `firestore.rules`).
4. **Storage** → actívalo (las reglas ya están en `storage.rules`).
5. En **Configuración del proyecto → Tus apps**, agrega una app **Web** (así obtienes las credenciales que usa el SDK de Firebase, aunque el destino final sea móvil).
6. Copia `.env.example` a `.env` y completa las variables `EXPO_PUBLIC_FIREBASE_*` con los datos de esa app.
7. Instala las herramientas de Firebase y despliega las reglas y funciones:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # selecciona tu proyecto
   firebase deploy --only firestore:rules,storage:rules
   ```

## 3. Configurar la transcripción automática (Cloud Function + OpenAI)

1. Obtén una API key en [platform.openai.com](https://platform.openai.com/api-keys).
2. Guárdala como secreto de Firebase Functions:

   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   ```

3. Instala dependencias y despliega la función:

   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

Cada vez que se sube un audio a `workspaces/{workspaceId}/voiceNotes/{noteId}.m4a`, la función `transcribeVoiceNote` se dispara sola, transcribe con Whisper y actualiza el documento en Firestore con el texto.

## 3.1 Configurar el asistente de chat (Claude)

La pestaña "Asistente" le permite a cualquiera de los dos escribirle (o hablarle) a Gaby en lenguaje natural (ej. "agéndame una reunión con Juan el viernes a las 3pm") y ella crea la cita sola usando la API de Claude (Anthropic).

1. Crea una cuenta y una API key en [console.anthropic.com](https://console.anthropic.com/).
2. Guárdala como secreto:

   ```bash
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```

3. Despliega (o vuelve a desplegar) las funciones:

   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

El modelo usado está fijo en el código (`functions/src/chat.ts`, constante `MODEL`, actualmente `claude-opus-5`) — si quieres usar otro, solo cambia ese valor y vuelve a desplegar.

### Comandos de voz ("Hey Gaby")

En la pestaña Asistente, toca el ícono de micrófono para activar el modo de voz: mientras la app esté abierta y en la pantalla, di **"Gaby"** seguido de tu pedido (o solo "Gaby" y luego espera a que te pregunte) y ella te responde hablando. Esto usa la Web Speech API del navegador (Safari/Chrome) tanto para escuchar como para hablar — solo funciona con la app abierta y en primer plano; no hay forma de escuchar con la pantalla apagada dentro de una app web, eso es una restricción de iOS/Android. Gaby elige automáticamente la mejor voz en español que ofrezca tu dispositivo/navegador.

## 4. Configurar el login de Google Calendar

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (mismo proyecto que Firebase), configura la **pantalla de consentimiento OAuth** (tipo "Externo", agrega tu correo y el de tu socio como *test users* mientras esté en modo prueba).
2. Habilita la **Google Calendar API** en "APIs y servicios → Biblioteca".
3. Crea credenciales OAuth 2.0 según cómo vayas a probar/distribuir la app:
   - **Web application**: su Client ID (`webClientId`) sirve tanto para pruebas dentro de Expo Go como base del flujo OAuth.
   - **iOS** y **Android**: para cuando compiles la app nativa con EAS (usa el `bundleIdentifier`/`package` de `app.json`).
4. Copia los Client IDs generados a tu `.env` (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`).

> **Nota:** el token de acceso de Google dura ~1 hora. Cuando expira, la app simplemente vuelve a pedir conexión al tocar "Sincronizar con Google Calendar" — no se maneja renovación silenciosa (`refresh token`) para no requerir un backend propio. Cada quien sincroniza sus citas a su propio Google Calendar.

## 5. Instalar y correr la app

```bash
npm install
npx expo start
```

Escanea el código QR con la app **Expo Go** en tu celular (Android) o con la cámara (iOS) para probarla de inmediato, sin necesidad de compilar nada.

## 6. Instalarla en tu iPhone sin Expo Go (PWA gratis, recomendado)

Si tu iPhone y tu PC no logran conectarse por WiFi/túnel para usar Expo Go (firewall, antivirus, red del router, etc.), esta opción evita el problema por completo: publicas Gaby como una página web y la "instalas" desde Safari — sin Mac, sin cuenta de Apple Developer, sin costo.

1. Instala las herramientas de Firebase y conecta tu proyecto (una sola vez):

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # selecciona tu proyecto (ej. gaby-c76cf)
   ```

2. Genera el build web y configura el hosting (una sola vez):

   ```bash
   npm run build:web
   firebase init hosting
   ```

   En las preguntas de `firebase init hosting`, responde:
   - "What do you want to use as your public directory?" → `dist`
   - "Configure as a single-page app?" → **Yes**
   - "Set up automatic builds and deploys with GitHub?" → **No**
   - Si pregunta si sobrescribir `dist/index.html` → **No**

3. Publica:

   ```bash
   npm run deploy:web
   ```

   Al terminar te da una URL tipo `https://gaby-c76cf.web.app`.

4. En tu iPhone, abre esa URL en **Safari** (no en Chrome, tiene que ser Safari) → toca el ícono de **Compartir** (el cuadrito con la flecha) → **"Agregar a inicio"**. Te va a quedar un ícono de "Gaby" en tu pantalla de inicio que abre directo, sin la barra del navegador.

Cada vez que hagamos cambios a la app, solo necesitas correr `npm run deploy:web` de nuevo y refrescar la página en tu iPhone.

## 7. Generar una app instalable nativa (opcional, más adelante)

Cuando quieras algo 100% nativo (ícono propio en la App Store/Play Store, notificaciones push, etc.), usa [EAS Build](https://docs.expo.dev/build/introduction/). En iPhone esto requiere una cuenta de pago de Apple Developer Program (99 USD/año), ya que Apple no permite instalar apps propias sin ella si no tienes Mac:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # o --platform ios
```

## Cómo lo usan tú y tu socio

1. Cada quien se registra con su correo (pantalla "Crear una cuenta").
2. La primera persona crea el espacio de trabajo (le pone un nombre) y recibe un **código de invitación** de 6 caracteres (visible en la pantalla de Inicio).
3. La segunda persona elige "Unirme con código" e ingresa ese código.
4. A partir de ahí, las citas y notas de voz que cree cualquiera de los dos aparecen en tiempo real para ambos.

## Próximos pasos sugeridos

- Notificaciones push antes de cada cita (Expo Notifications).
- Recordatorios automáticos por voz o resumen diario.
- Renovación silenciosa del token de Google (requeriría un pequeño backend/Cloud Function que guarde el refresh token de forma segura).
