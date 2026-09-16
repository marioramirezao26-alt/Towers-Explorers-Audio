# Gaby iOS (nativo)

Esqueleto de la futura app nativa de iOS, basado en la estructura de
[Scowld](https://github.com/apoorvdarshan/scowld) (SwiftUI + WKWebView +
puente nativo) — ver `THIRD_PARTY_NOTICES.md` para la atribución completa.

## Estado actual

Esto es un **esqueleto sin terminar**, todavía no es una app funcional:

- El visor 3D del avatar (`Scowld/Resources/amica.bundle/index.html`) es un
  marcador de posición — falta conectarlo con el visor Three.js/VRM que ya
  existe para la web (`src/components/GabyVrmFace.tsx` en la raíz del repo).
- Los proveedores de IA/voz propios de Scowld (`Scowld/AI/`, `Scowld/Core/CloudSTTProvider.swift`,
  etc.) siguen ahí tal cual se copiaron — todavía no están conectados a las
  Cloud Functions de Gaby (`deviceCommand`, `researchWithOpenAI`) ni a
  swift-realtime-openai.
- No tiene firma de código configurada (`DEVELOPMENT_TEAM` vacío) — hay que
  abrirlo en Xcode con tu propia cuenta de Apple y seleccionar tu equipo antes
  de poder instalarlo en un iPhone.

## Verificar que compila (sin Mac)

`.github/workflows/ios-build.yml` compila este proyecto en un runner de
macOS de GitHub Actions en cada push que lo toque — revisa la pestaña
"Actions" del repo para ver si pasó. Esto **no** genera un build instalable
(no firma el código), solo confirma que el Swift compila.

## Abrir en Xcode (necesitas una Mac — ver el README principal, sección
"Un cuerpo físico para Gaby" y el chat de esta sesión para las opciones de
Mac remota)

```bash
open ios-native/Scowld.xcodeproj
```

Selecciona tu equipo de firma en "Signing & Capabilities" antes de compilar
para tu propio iPhone.
