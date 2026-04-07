<h1>
<div align="center">
<img alt="LogoFis" src="src/assets/brand/fiscalia-icon-with-brand.png" width="90%">
</div>
</h1>

ArchiveWeb.page es una aplicación basada en JavaScript para el archivo web interactivo y de alta fidelidad que se ejecuta directamente en el navegador. El sistema puede usarse como una extensión de navegador basada en Chrome/Chromium.

El sistema crea, almacena y reproduce archivos web de alta fidelidad guardados directamente en el almacenamiento del navegador (a través de IndexedDB).

Para obtener información más detallada sobre cómo usar la extensión, consulta la [Guía de usuario de ArchiveWeb.page](https://archiveweb.page/guide).

La extensión para el navegador está disponible en la [Chrome Web Store](https://chrome.google.com/webstore/detail/webrecorder/fpeoodllldobpkbkabpblcfaogecpndd).

## Arquitectura

La extensión hace uso del protocolo de depuración de Chrome para capturar y guardar el tráfico de red, y extiende la interfaz de usuario de [ReplayWeb.page](https://github.com/webrecorder/replayweb.page) y el sistema de service worker [wabac.js](https://github.com/webrecorder/wabac.js) para la reproducción y el almacenamiento.

## Desarrollo

### Requisitos previos

  - Node \>=12
  - Yarn Classic (v1)

### Instalación

Para compilar la extensión localmente para el desarrollo, haz lo siguiente:

1.  Clona este repositorio:
    ```sh
    git clone https://github.com/webrecorder/archiveweb.page.git
    ```
2.  Cambia al directorio de trabajo:
    ```sh
    cd archiveweb.page
    ```
3.  Instala las dependencias:
    ```sh
    yarn install
    ```
4.  Crea la compilación de desarrollo (*build*):
    ```sh
    yarn build-dev
    ```

La compilación de desarrollo ahora se puede usar para desarrollar la extensión.

### Desarrollo de la extensión para Chromium

Para instalar la extensión localmente, carga la compilación de desarrollo como una extensión sin empaquetar:

1.  Abre la página de Extensiones de Chrome ([chrome://extensions](https://www.google.com/search?q=chrome://extensions)).

2.  Elige 'Cargar descomprimida' (*Load Unpacked Extension*) y selecciona el directorio `./dist/ext` en tu copia local de este repositorio.

3.  Haz clic en el icono de la extensión para mostrar la ventana emergente de la extensión, comenzar a archivar, etc...

#### Actualizar la extensión tras cambios en el código

Para observar (*watch*) los archivos de código fuente y recompilar automáticamente la versión de desarrollo al detectar cambios, ejecuta:

```sh
yarn run start-ext
```

Ahora, al guardar los cambios en el código fuente, se reconstruirá automáticamente el directorio `dist/ext`.

Después de realizar cambios, aún es necesario recargar la extensión en el navegador.

1.  Desde la página de extensiones de Chrome, haz clic en el botón de recargar para cargar la última versión.

2.  Haz clic en el icono de la extensión para mostrar la ventana emergente, comenzar a grabar, etc. La versión de desarrollo de la extensión tendrá un color diferente al de la versión de producción.