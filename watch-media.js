const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

// Ruta a las carpetas que queremos monitorear
const ALBUMS_PATH = path.join(__dirname, 'src', 'assets', 'Albumes');

console.log(`Monitoreando cambios en ${ALBUMS_PATH}...`);

// Inicializar watcher
const watcher = chokidar.watch(ALBUMS_PATH, {
  ignored: /(^|[\/\\])\../, // Ignorar archivos ocultos
  persistent: true,
  ignoreInitial: true
});

// Función para generar los JSON cuando hay cambios
const generateJSON = () => {
  console.log('Cambios detectados, regenerando archivos JSON...');
  exec('node generate-media-json.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al regenerar JSON: ${error}`);
      return;
    }
    console.log(stdout);
  });
};

// Eventos a monitorear
watcher
  .on('add', path => {
    console.log(`Archivo añadido: ${path}`);
    generateJSON();
  })
  .on('unlink', path => {
    console.log(`Archivo eliminado: ${path}`);
    generateJSON();
  })
  .on('addDir', path => {
    console.log(`Carpeta añadida: ${path}`);
    generateJSON();
  })
  .on('unlinkDir', path => {
    console.log(`Carpeta eliminada: ${path}`);
    generateJSON();
  });

console.log('Monitoreo iniciado. Presiona Ctrl+C para detener.');
