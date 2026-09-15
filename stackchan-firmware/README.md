# Stack-chan de Gaby

Firmware para darle a Gaby un cuerpo físico: un [Stack-chan](https://github.com/meganetaaan/stack-chan)
armado sobre un **M5Stack Core2** con cuello de 2 servos, que le manda tus pedidos
al backend de Gaby (Firebase) y muestra la respuesta en pantalla.

> **Nota:** el repo "oficial" de Stack-chan usa Moddable SDK (JavaScript embebido),
> un entorno bastante más pesado de instalar. Este firmware usa en cambio
> **Arduino + PlatformIO** con la librería [M5Stack-Avatar](https://github.com/meganetaaan/m5stack-avatar)
> (del mismo autor) para la carita — es el camino que sigue la mayoría de los
> Stack-chan caseros y es mucho más simple de armar y modificar.

## Qué necesitas

- **M5Stack Core2** (o Core S3).
- **Kit de cuello Stack-chan**: 2 servos SG90 + soporte (comprado o impreso en 3D).
- [VS Code](https://code.visualstudio.com/) + extensión **PlatformIO IDE**.
- Cable USB-C.

## Configurar

1. Copia `src/secrets.h.example` a `src/secrets.h` y completa tus datos (WiFi,
   la URL de tu Cloud Function `deviceCommand`, el secreto de dispositivo y el
   id de tu workspace). `secrets.h` está en `.gitignore` — nunca lo subas a git.
2. Antes de flashear, despliega el backend (ver raíz del repo, sección del
   asistente en el `README.md` principal) y configura el secreto compartido:

   ```bash
   firebase functions:secrets:set DEVICE_SHARED_SECRET
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```

   Usa ese mismo valor en `DEVICE_SHARED_SECRET` dentro de `secrets.h`. La URL
   del endpoint (`GABY_ENDPOINT`) te la muestra la terminal al terminar el
   deploy, o la consola de Firebase → Functions.

3. Abre esta carpeta (`stackchan-firmware/`) en VS Code con PlatformIO, conecta
   el Core2 por USB, y dale "Upload" (ícono de flecha en la barra inferior).

## Qué hace la v1

Al prender el robot, se conecta al WiFi y muestra la carita en reposo (con un
vaivén de cuello suave). Al presionar el **botón A** de la pantalla, manda una
pregunta de prueba fija ("¿qué hora es?") a Gaby y muestra la respuesta como
globo de texto sobre la cara, con la expresión cambiando según el resultado
(pensando / feliz al responder / triste si hubo un error).

Esto es solo el primer punto de contacto entre el robot y el backend — todavía
no tiene micrófono conectado (v1 usa un botón, no voz) y los pedidos que
mande siempre pasan por OpenAI (el router local de "agendar/anotar" vive del
lado de la app en JavaScript, no está portado a este firmware todavía).

## Próximos pasos posibles

- Cambiar el botón de prueba por un micrófono I2S + reconocimiento de voz (el
  Core2 trae micrófono integrado).
- Reproducir la respuesta por el altavoz del Core2 (con un audio generado por
  algún servicio de texto a voz, descargado y reproducido vía I2S).
- Portar el router local de citas/notas (`src/services/localAssistant.ts` en
  la raíz del repo) al backend, para que el robot también pueda agendar/anotar
  sin pasar por OpenAI.
