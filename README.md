<h1>
  <div align="center">
    <img alt="LogoFis" src="src/assets/brand/fiscalia-icon-with-brand.png" width="50%">
  </div>
</h1>

# Extensión de Archivado Digital para el módulo de hemeroteca del SIAI (Sistema Integral de Análisis de Información)

<div align="center">
  <p>Esta es una aplicación basada en JavaScript para el archivo web interactivo y de alta fidelidad que se ejecuta directamente en el navegador. El sistema se usa como una extensión de navegador basada en Chrome/Chromium.</p>
  <p>El sistema crea, almacena y reproduce archivos web de alta fidelidad guardados directamente en el almacenamiento del navegador (a través de IndexedDB).</p>
</div>

Para obtener información más detallada sobre el funcionamiento base, consulta la [Guía de usuario de ArchiveWeb.page](https://archiveweb.page/guide).

## Capturas de Pantalla

### 1. Pantalla de Inicio
<div align="center">
  <img alt="Inicio de la extensión" src="static/screenshots/extension-home.png" width="70%">
</div>

### 2. Proceso de Archivado en Curso
<div align="center">
  <img alt="Archivado en curso" src="static/screenshots/extension-archiving.png" width="70%">
</div>

### 3. Finalización y Guardado (Uploading)
<div align="center">
  <img alt="Finalización y guardado" src="static/screenshots/extension-uploading.png" width="70%">
</div>

## Arquitectura

La extensión hace uso del protocolo de depuración de Chrome para capturar y guardar el tráfico de red, y extiende la interfaz de usuario de [ReplayWeb.page](https://github.com/webrecorder/replayweb.page) y el sistema de service worker [wabac.js](https://github.com/webrecorder/wabac.js) para la reproducción y el almacenamiento.

## Desarrollo

### Requisitos previos

  - Node >=12
  - Yarn Classic (v1)

### Instalación

Para compilar la extensión localmente para el desarrollo, haz lo siguiente:

1.   Clona este repositorio:
    ```sh
    git clone [https://github.com/webrecorder/archiveweb.page.git](https://github.com/webrecorder/archiveweb.page.git)
    ```
2.   Cambia al directorio de trabajo:
    ```sh
    cd archiveweb.page
    ```
3.   Instala las dependencias:
    ```sh
    yarn install
    ```
4.   Crea la compilación de desarrollo (*build*):
    ```sh
    yarn build-dev
    ```

La compilación de desarrollo ahora se puede usar para desarrollar la extensión.

### Desarrollo de la extensión para Chromium

Para instalar la extensión localmente, carga la compilación de desarrollo como una extensión sin empaquetar:

1.   Abre la página de Extensiones de Chrome ([chrome://extensions](https://www.google.com/search?q=chrome://extensions)).

2.   Elige 'Cargar descomprimida' (*Load Unpacked Extension*) y selecciona el directorio `./dist/ext` en tu copia local de este repositorio.

3.   Haz clic en el icono de la extensión para mostrar la ventana emergente de la extensión, comenzar a archivar, etc...