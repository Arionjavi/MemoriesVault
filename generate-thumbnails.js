const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuración
const ASSETS_PATH = path.join(__dirname, 'src', 'assets');
const ALBUMS_PATH = path.join(ASSETS_PATH, 'Albumes');
const THUMBS_PATH = path.join(ASSETS_PATH, 'thumbnails');

// Asegúrate de que el directorio de thumbnails exista
if (!fs.existsSync(THUMBS_PATH)) {
  fs.mkdirSync(THUMBS_PATH, { recursive: true });
}

// Extensiones de archivos de imagen
const IMAGE_EXTENSIONS = ['.jpg', 'JEPG', '.jpeg', '.png', '.gif', '.webp'];

// Función para procesar un archivo de imagen
async function processImage(imagePath, outputDir, fileName) {
  try {
    // Crea el directorio de destino si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const fileNameNoExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    
    // Genera versión pequeña (400px)
    await sharp(imagePath)
      .resize(400, null, { fit: 'inside' })
      .jpeg({ quality: 70 })
      .toFile(path.join(outputDir, `${fileNameNoExt}-small${ext}`));
    
    // Genera versión mediana (800px)
    await sharp(imagePath)
      .resize(800, null, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(path.join(outputDir, `${fileNameNoExt}-medium${ext}`));
    
    console.log(`Processed: ${fileName}`);
  } catch (error) {
    console.error(`Error processing ${fileName}: ${error.message}`);
  }
}

// Función para recorrer directorios recursivamente
async function processDirectory(dirPath, relativePath = '') {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Si es un directorio, procesa recursivamente
      const newRelativePath = path.join(relativePath, file);
      await processDirectory(filePath, newRelativePath);
    } else {
      // Si es un archivo, verifica si es una imagen
      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        const outputDir = path.join(THUMBS_PATH, relativePath);
        await processImage(filePath, outputDir, file);
      }
    }
  }
}

// Ejecutar el procesamiento
(async () => {
  console.log('Starting thumbnail generation...');
  await processDirectory(ALBUMS_PATH);
  console.log('Thumbnail generation complete!');
})();
