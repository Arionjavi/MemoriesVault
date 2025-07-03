const fs = require('fs');
const path = require('path');
const { getVideoDurationInSeconds } = require('get-video-duration');

// Configuración
const ASSETS_PATH = path.join(__dirname, 'src', 'assets');
const ALBUMS_PATH = path.join(ASSETS_PATH, 'Albumes');
const OUTPUT_PATH = path.join(ASSETS_PATH, 'data');

// Crear directorio de salida si no existe
if (!fs.existsSync(OUTPUT_PATH)) {
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });
}

// Extensiones válidas
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

function getFileType(extension) {
  if (IMAGE_EXTENSIONS.includes(extension.toLowerCase())) return 'image';
  if (VIDEO_EXTENSIONS.includes(extension.toLowerCase())) return 'video';
  return 'unknown';
}

function generateUniqueId(albumId, fileName, existingIds) {
  let baseId = `${albumId}_${fileName.toLowerCase().replace(/\s+/g, '_')}`;
  let counter = 1;
  let uniqueId = baseId;
  
  while (existingIds.has(uniqueId)) {
    uniqueId = `${baseId}_${counter}`;
    counter++;
  }
  
  existingIds.add(uniqueId);
  return uniqueId;
}

// Función para formatear duración
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' + secs : secs}`;
}

// Función para generar fecha basada en el año de la carpeta
function generateDateForYear(year, fileName) {
  const yearNum = parseInt(year);
  if (isNaN(yearNum)) {
    return new Date().toISOString();
  }
  
  const startOfYear = new Date(yearNum, 0, 1);
  const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59);
  
  let hash = 0;
  for (let i = 0; i < fileName.length; i++) {
    const char = fileName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const timeRange = endOfYear.getTime() - startOfYear.getTime();
  const randomTime = Math.abs(hash) % timeRange;
  
  return new Date(startOfYear.getTime() + randomTime).toISOString();
}

// Función para obtener duración real del video
async function getVideoInfo(videoPath) {
  try {
    const duration = await getVideoDurationInSeconds(videoPath);
    return {
      duration: formatDuration(duration),
      durationSeconds: duration
    };
  } catch (error) {
    console.warn(`No se pudo obtener duración de ${videoPath}:`, error.message);
    return {
      duration: "0:00",
      durationSeconds: 0
    };
  }
}

// Escanear álbumes
const albums = [];
const yearMediaMap = {};
const allIds = new Set();

console.log('Escaneando álbumes...');

if (!fs.existsSync(ALBUMS_PATH)) {
  console.error(`Error: No se encontró la carpeta ${ALBUMS_PATH}`);
  process.exit(1);
}

const yearFolders = fs.readdirSync(ALBUMS_PATH)
  .filter(name => fs.statSync(path.join(ALBUMS_PATH, name)).isDirectory());

console.log(`Encontradas ${yearFolders.length} carpetas de años:`, yearFolders);

async function processAlbums() {
  for (const yearFolder of yearFolders) {
    const yearPath = path.join(ALBUMS_PATH, yearFolder);
    const isYearFolder = /^\d{4}$/.test(yearFolder);
    
    if (isYearFolder) {
      const albumFolders = fs.readdirSync(yearPath)
        .filter(name => fs.statSync(path.join(yearPath, name)).isDirectory());
      
      for (const albumName of albumFolders) {
        const albumId = albumName.toLowerCase().replace(/\s+/g, '');
        albums.push({
          id: albumId,
          name: albumName,
          year: yearFolder,
          path: `assets/Albumes/${yearFolder}/${albumName}`
        });
        
        await scanMediaFiles(path.join(yearPath, albumName), yearFolder, albumId);
      }
    }
  }
}

async function scanMediaFiles(dirPath, year, albumId) {
  if (!fs.existsSync(dirPath)) return;
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      await scanMediaFiles(filePath, year, albumId);
    } else {
      const extension = path.extname(file);
      const fileType = getFileType(extension);
      
      if (fileType !== 'unknown') {
        const relativePath = filePath.replace(ASSETS_PATH, 'assets').replace(/\\/g, '/');
        const fileName = path.basename(file, extension);
        const id = generateUniqueId(albumId, fileName, allIds);
        
        if (!yearMediaMap[year]) {
          yearMediaMap[year] = [];
        }
        
        const mediaItem = {
          id: id,
          name: fileName,
          type: fileType,
          extension: extension.substring(1),
          path: relativePath,
          date: generateDateForYear(year, fileName),
          album: albumId
        };
        
        // Para videos, obtener duración real y buscar thumbnail
        if (fileType === 'video') {
          console.log(`Procesando video: ${fileName}`);
          
          // Obtener duración real
          try {
            const videoInfo = await getVideoInfo(filePath);
            mediaItem.duration = videoInfo.duration;
            mediaItem.durationSeconds = videoInfo.durationSeconds;
          } catch (error) {
            mediaItem.duration = "0:00";
            mediaItem.durationSeconds = 0;
          }
          
          // Buscar thumbnails existentes
          const possibleThumbnails = [
            path.join(dirPath, `${fileName}_thumb.jpg`),
            path.join(dirPath, `${fileName}_thumb.png`),
            path.join(dirPath, `${fileName}.jpg`),
            path.join(dirPath, `${fileName}.png`)
          ];
          
          for (const thumbPath of possibleThumbnails) {
            if (fs.existsSync(thumbPath)) {
              mediaItem.thumbnail = thumbPath.replace(ASSETS_PATH, 'assets').replace(/\\/g, '/');
              break;
            }
          }
          
          // Si no hay thumbnail, marcamos para generar uno en el navegador
          if (!mediaItem.thumbnail) {
            mediaItem.needsThumbnail = true;
          }
        }
        
        yearMediaMap[year].push(mediaItem);
      }
    }
  }
}

// Ejecutar proceso
async function main() {
  try {
    await processAlbums();
    
    // Escribir archivos JSON
    fs.writeFileSync(
      path.join(OUTPUT_PATH, 'albums.json'),
      JSON.stringify({ albums }, null, 2)
    );
    
    console.log(`Generado albums.json con ${albums.length} álbumes`);
    
    Object.keys(yearMediaMap).forEach(year => {
      const sortedItems = yearMediaMap[year].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      fs.writeFileSync(
        path.join(OUTPUT_PATH, `media-${year}.json`),
        JSON.stringify({ mediaItems: sortedItems }, null, 2)
      );
      
      console.log(`Generado media-${year}.json con ${sortedItems.length} elementos`);
    });
    
    console.log('¡Proceso completado exitosamente!');
  } catch (error) {
    console.error('Error durante el procesamiento:', error);
  }
}

main();
