# Avisos de terceros

Este proyecto (`ios-native/`) parte de la estructura de **Scowld**
(https://github.com/apoorvdarshan/scowld), reutilizada como esqueleto de la
app (SwiftUI + WKWebView + puente nativo) bajo los términos de su licencia
MIT. El contenido de `Scowld/Resources/amica.bundle/` (el frontend web del
avatar 3D de Scowld, basado en el proyecto Amica) **no se copió** — se
reemplazó por un marcador de posición, porque los assets de esa carpeta
(modelos VRM, imágenes) no tienen todos licencia clara para redistribuir
aquí. El visor 3D real de Gaby se conecta ahí en un paso posterior,
reutilizando el código Three.js/three-vrm ya escrito para la versión web
(`src/components/GabyVrmFace.tsx`), no el de Scowld/Amica.

## Scowld

```
MIT License

Copyright (c) 2026 Apoorv Darshan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## swift-realtime-openai (planeado)

https://github.com/m1guelpf/swift-realtime-openai — MIT License. Se agregará
como dependencia de Swift Package Manager cuando se integre la conversación
de voz en tiempo real.

## VRMKit (evaluación futura)

https://github.com/tattn/VRMKit — MIT License. Alternativa nativa (SceneKit)
al WebView, si se decide reemplazarlo más adelante.
