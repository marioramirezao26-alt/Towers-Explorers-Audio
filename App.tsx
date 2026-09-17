import React from 'react';
import StartupError from './src/components/StartupError';

/**
 * Cascarón mínimo: solo carga la app de verdad y, si eso falla, enseña por qué.
 *
 * Importar src/AppMain arriba, como es habitual, haría que un error al cargar
 * cualquiera de sus módulos (Firebase, la navegación, un módulo nativo que no
 * quedó enlazado) reventara antes de que React exista. En Android eso se ve
 * como la app cerrándose sola, sin mensaje, y solo se puede diagnosticar
 * conectando el teléfono a un computador. Cargándola dentro de un try/catch,
 * ese mismo error queda en pantalla y basta una captura.
 *
 * Por eso este archivo importa únicamente React y la pantalla de error, y esa
 * pantalla no importa nada del proyecto: entre los dos no hay nada que pueda
 * fallar por lo mismo que se está intentando reportar.
 */

let errorDeCarga: Error | null = null;
let AppMain: React.ComponentType | null = null;

try {
  AppMain = require('./src/AppMain').default;
} catch (error) {
  errorDeCarga = error instanceof Error ? error : new Error(String(error));
}

/** ErrorUtils es un global de React Native; no viene en los tipos. */
declare const ErrorUtils: {
  getGlobalHandler?: () => ((error: unknown, esFatal?: boolean) => void) | undefined;
  setGlobalHandler: (handler: (error: unknown, esFatal?: boolean) => void) => void;
};

export default function App() {
  const [errorGlobal, setErrorGlobal] = React.useState<Error | null>(null);

  React.useEffect(() => {
    // Los errores fuera del render (una promesa rechazada, un callback de un
    // módulo nativo) no llegan a ningún ErrorBoundary: en una compilación de
    // release el manejador por defecto cierra la app en el acto. Se reemplaza
    // para mostrarlos, y a propósito no se llama al anterior, que es justamente
    // el que cerraría la app.
    if (typeof ErrorUtils === 'undefined') return;
    ErrorUtils.setGlobalHandler((error, esFatal) => {
      if (!esFatal) return;
      setErrorGlobal(error instanceof Error ? error : new Error(String(error)));
    });
  }, []);

  if (errorDeCarga) {
    return <StartupError error={errorDeCarga} origen="Cargar la app (require de src/AppMain)" />;
  }
  if (errorGlobal) {
    return <StartupError error={errorGlobal} origen="Error fatal en tiempo de ejecución" />;
  }

  const Main = AppMain as React.ComponentType;
  return <Main />;
}
