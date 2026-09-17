import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Trae el orbe al paquete de escritorio antes de empaquetar.
 *
 * El orbe vive en un solo sitio (el visor de la app de iOS) y de ahí lo toman
 * tanto el teléfono como el escritorio: copiarlo en el momento de compilar
 * evita tener dos versiones del mismo dibujo que se vayan separando con el
 * tiempo. Por eso desktop/orbe/ no se versiona.
 */
const aqui = dirname(fileURLToPath(import.meta.url));
const origen = join(aqui, '..', 'ios-native', 'Scowld', 'Resources', 'amica.bundle');
const destino = join(aqui, 'orbe');

await mkdir(destino, { recursive: true });
await cp(origen, destino, { recursive: true });
await cp(join(aqui, '..', 'assets', 'icon.png'), join(aqui, 'icono.png'));

console.log(`Orbe copiado a ${destino}`);
