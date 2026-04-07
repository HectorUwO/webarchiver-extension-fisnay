<div align="center">
  <img alt="LogoFis" src="src/assets/brand/fiscalia-icon-with-brand.png" width="50%">
</div>

## Extensión de Archivado Digital (Hemeroteca SIAI)

Extensión para **Chrome/Chromium** orientada al módulo de hemeroteca del **SIAI (Sistema Integral de Análisis de Información)**. Permite **capturar**, **almacenar** y **reproducir** archivos web de alta fidelidad directamente desde el navegador, guardándolos en el almacenamiento del navegador (IndexedDB).

- **Base tecnológica**: deriva del proyecto **ArchiveWeb.page**.
- **Guía funcional (referencia)**: [ArchiveWeb.page User Guide](https://archiveweb.page/guide).

## Inicio rápido (desarrollo)

### Requisitos previos

- **Node.js**: >= 12 (recomendado: LTS reciente si tu entorno lo permite)
- **Yarn Classic (v1)**

### Instalación

1. Clona este repositorio y entra al directorio:

```sh
git clone <URL_DE_ESTE_REPOSITORIO>
cd webarchiver-extension-fisnay
```

2. Instala dependencias:

```sh
yarn install
```

3. Compila en modo desarrollo:

```sh
yarn build-dev
```

### Cargar la extensión en Chromium

1. Abre `chrome://extensions`.
2. Activa **Modo desarrollador**.
3. Selecciona **Cargar descomprimida** y elige la carpeta:
   - `./dist/ext`

Para desarrollo iterativo (watch), puedes usar:

```sh
yarn start-ext
```

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

## Scripts útiles

Estos comandos están definidos en `package.json`:

- **Build producción**:

```sh
yarn build
```

- **Lint**:

```sh
yarn lint
```

- **Formato**:

```sh
yarn format
```

- **Empaquetado (Electron / distribución)**:

```sh
yarn dist
```

## Notas y resolución de problemas

- **No veo cambios al recompilar**: si estás usando `yarn start-ext` (watch), normalmente debes **recargar** la extensión en `chrome://extensions` (botón de recarga) y/o recargar la página que estás archivando.
- **Ruta de carga**: asegúrate de cargar exactamente `./dist/ext` (no `./dist`).
- **Errores de dependencias**: borra `node_modules` y vuelve a instalar con `yarn install`.

## Créditos

Basado en el ecosistema de Webrecorder: [ArchiveWeb.page](https://archiveweb.page/), [ReplayWeb.page](https://github.com/webrecorder/replayweb.page) y [wabac.js](https://github.com/webrecorder/wabac.js).