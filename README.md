<div align="center">
  <img alt="LogoFis" src="src/assets/brand/fiscalia-icon-with-brand.png" width="50%">
</div>

# Extensión de Archivado Digital (Hemeroteca SIAI)

[![Chrome/Chromium](https://img.shields.io/badge/Browser-Chrome%2FChromium-4285F4?logo=googlechrome&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D12-339933?logo=nodedotjs&logoColor=white)](#)
[![Yarn Classic](https://img.shields.io/badge/Yarn-Classic%20v1-2C8EBB?logo=yarn&logoColor=white)](#)

> Extensión para **navegadores basados en Chromium** orientada al módulo de hemeroteca del **SIAI (Sistema Integral de Análisis de Información)**.
> Permite **capturar**, **almacenar** y **reproducir** archivos web de alta fidelidad directamente desde el navegador,
> guardándolos en almacenamiento local del navegador (**IndexedDB**).

---

## Tabla de contenidos

- [Información general](#información-general)
- [Navegadores compatibles](#navegadores-compatibles)
- [Inicio rápido (desarrollo)](#inicio-rápido-desarrollo)
- [Capturas de pantalla](#capturas-de-pantalla)
- [Arquitectura](#arquitectura)
- [Scripts disponibles](#scripts-disponibles)
- [Resolución de problemas](#resolución-de-problemas)
- [Créditos](#créditos)

## Información general

- **Base tecnológica:** deriva del proyecto **ArchiveWeb.page**.
- **Guía funcional de referencia:** [ArchiveWeb.page User Guide](https://archiveweb.page/guide).

## Navegadores compatibles

La extensión depende de **Manifest V3**, la API **`chrome.debugger`** y otras APIs de **Chrome Extensions**, por lo que su compatibilidad está orientada a navegadores **basados en Chromium**.

| Navegador | Compatibilidad |
| --- | --- |
| ![Google Chrome](https://img.shields.io/badge/Google%20Chrome-4285F4?logo=googlechrome&logoColor=white) | Compatible |
| ![Chromium](https://img.shields.io/badge/Chromium-4A8AF4?logo=chromium&logoColor=white) | Compatible |
| ![Microsoft Edge](https://img.shields.io/badge/Microsoft%20Edge-0078D7?logo=microsoftedge&logoColor=white) | Compatible |
| ![Brave](https://img.shields.io/badge/Brave-FB542B?logo=brave&logoColor=white) | Compatible |
| ![Opera](https://img.shields.io/badge/Opera-FF1B2D?logo=opera&logoColor=white) | Compatible |

> Nota: en navegadores no basados en Chromium, o en variantes que restrinjan el uso de `chrome.debugger`, la extensión puede no funcionar correctamente.

---

## Inicio rápido (desarrollo)

### Requisitos previos

- **Node.js:** >= 12 (recomendado: LTS reciente).
- **Yarn Classic (v1)**.

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
3. Selecciona **Cargar descomprimida** y elige la carpeta `./dist/ext`.

Para desarrollo iterativo (watch):

```sh
yarn start-ext
```

---

## Capturas de pantalla

| 1) Pantalla de inicio | 2) Proceso de archivado en curso | 3) Finalización y guardado (Uploading) |
| --- | --- | --- |
| <img alt="Inicio de la extensión" src="static/screenshots/extension-home.png" width="100%"> | <img alt="Archivado en curso" src="static/screenshots/extension-archiving.png" width="100%"> | <img alt="Finalización y guardado" src="static/screenshots/extension-uploading.png" width="100%"> |

---

## Arquitectura

La extensión hace uso del protocolo de depuración de Chrome para capturar y guardar tráfico de red, y extiende la interfaz de [ReplayWeb.page](https://github.com/webrecorder/replayweb.page) y el service worker [wabac.js](https://github.com/webrecorder/wabac.js) para reproducción y almacenamiento.

---

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `yarn build-dev` | Build de desarrollo. |
| `yarn start-ext` | Compilación en modo watch para iteración rápida. |
| `yarn build` | Build de producción. |
| `yarn lint` | Lint del proyecto. |
| `yarn format` | Formato automático. |
| `yarn dist` | Empaquetado para distribución. |

---

## Resolución de problemas

### No se reflejan cambios en la extensión

- Si usas `yarn start-ext`, recarga la extensión en `chrome://extensions`.
- Recarga la extensión en `chrome://extensions`.
- Recarga la página objetivo que estás archivando.

### Error al cargar la extensión

- Asegúrate de cargar exactamente `./dist/ext` (no `./dist`).
- Ejecuta `yarn build-dev` nuevamente.

### Inconsistencias de dependencias

```sh
rm -rf node_modules
yarn install
```

En Windows (PowerShell):

```powershell
Remove-Item -Recurse -Force node_modules
yarn install
```

---

## Créditos

Basado en el ecosistema de Webrecorder:

- [ArchiveWeb.page](https://archiveweb.page/)
- [ReplayWeb.page](https://github.com/webrecorder/replayweb.page)
- [wabac.js](https://github.com/webrecorder/wabac.js)