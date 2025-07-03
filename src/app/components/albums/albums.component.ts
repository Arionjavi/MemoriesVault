import { Component, OnInit, Inject, PLATFORM_ID, Input, SimpleChanges, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaItemComponent } from '../media-item/media-item.component';
import { ImageViewerComponent } from '../image-viewer/image-viewer.component';
import { AlbumService } from '../../services/album.service';
import { MediaService } from '../../services/media.service';
import { FavoriteService } from '../../services/favorite.service';
import { Album } from '../../models/album.model';
import { MediaItem } from '../../models/media-item.model';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ScrollToTopComponent } from '../scroll-to-top/scroll-to-top.component';


interface AlbumWithCover extends Album {
  coverPhotos: (MediaItem | null)[];
  photoCount: number;
}

@Component({
  selector: 'app-albums',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MediaItemComponent,
    ImageViewerComponent,
    ScrollToTopComponent
  ],
  templateUrl: './albums.component.html',
  styleUrls: ['./albums.component.scss']
})
export class AlbumsComponent implements OnInit {
  albums: AlbumWithCover[] = [];
  selectedAlbum: AlbumWithCover | null = null;
  selectedAlbumPhotos: MediaItem[] = [];
  selectedItems: MediaItem[] = [];
  loadingAlbumPhotos = false;
  downloadInProgress = false;
  lastClickedIndex: number | null = null;
  @Input() selectedAlbumId?: string;
  @Output() albumSelectedFromGrid = new EventEmitter<string>();
  
  // 🎯 PROPIEDADES PARA VISUALIZADOR Y SCROLL
  isViewerOpen = false;
  currentViewIndex = 0;
  private lastViewerIndex: number = 0;
  private scrollPositionBeforeViewer: number = 0;
  private isViewerClosing: boolean = false;

  // Zoom
  zoomLevel = 6;
  get itemsPerRow(): number {
    return this.zoomLevel;
  }

  // Filtro por año
  availableYears: number[] = [];
  selectedFilterYear: number | null = null;
  isYearDropdownOpen = false;

  constructor(
    private albumService: AlbumService,
    private mediaService: MediaService,
    private favoriteService: FavoriteService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedZoom = localStorage.getItem('albums-zoom-level');
      if (savedZoom) {
        this.zoomLevel = Number(savedZoom);
      }
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.year-filter')) {
          this.isYearDropdownOpen = false;
        }
      });
    }
    this.loadAlbums();
  }

  loadAlbums(): void {
    this.albumService.getAlbums().subscribe({
      next: async (albums) => {
        this.albums = await Promise.all(
          albums.map(async (album) => {
            const allAlbumMedia = await this.getAlbumPhotos(album.id);
            
            // FILTRAR SOLO IMÁGENES PARA LA PORTADA
            const onlyImages = allAlbumMedia.filter(item => item.type === 'image');
            const shuffledImages = this.shuffleArray([...onlyImages]);
            
            return {
              ...album,
              // Solo imágenes para la portada (máximo 4)
              coverPhotos: this.padArray(shuffledImages.slice(0, 4), 4),
              // Conteo total de todos los elementos (imágenes + videos)
              photoCount: allAlbumMedia.length
            };
          })
        );
      },
      error: (error) => {
        console.error('Error loading albums:', error);
      }
    });
  }

  private async getAlbumPhotos(albumId: string): Promise<MediaItem[]> {
    return new Promise((resolve) => {
      this.mediaService.getAllMediaItems().subscribe({
        next: (allMedia) => {
          const albumPhotos = allMedia.filter(item => item.album === albumId);
          resolve(albumPhotos);
        },
        error: () => resolve([])
      });
    });
  }

  selectAlbum(album: AlbumWithCover): void {
    this.selectedAlbum = album;
    this.selectedItems = [];
    this.loadAlbumPhotos(album.id);
    this.albumSelectedFromGrid.emit(album.id);
  }

  private loadAlbumPhotos(albumId: string): void {
    this.loadingAlbumPhotos = true;
    this.mediaService.getMediaByAlbum(albumId).subscribe({
      next: (photos) => {
        this.selectedAlbumPhotos = photos;
        this.loadingAlbumPhotos = false;
      },
      error: () => this.loadingAlbumPhotos = false
    });
  }

  extractAvailableYears(): void {
    const yearsSet = new Set<number>();
    this.selectedAlbumPhotos.forEach(item => {
      const year = this.getYear(item);
      if (year) yearsSet.add(year);
    });
    this.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
  }

  getYear(item: MediaItem): number | null {
    if (!item.date) return null;
    const dateObj = new Date(item.date);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.getFullYear();
  }

goBackToAlbums(): void {
  // 🎯 RESETEAR COMPLETAMENTE EL ESTADO
  this.selectedAlbum = null;
  this.selectedAlbumPhotos = [];
  this.selectedItems = [];
  this.lastClickedIndex = null;
  this.isViewerOpen = false;
  this.loadingAlbumPhotos = false;
  
  // 🎯 NOTIFICAR AL COMPONENTE PADRE
  this.albumSelectedFromGrid.emit('');
}


  // Filtro por año
  toggleYearDropdown(): void {
    this.isYearDropdownOpen = !this.isYearDropdownOpen;
  }

  filterByYear(year: number | null): void {
    this.selectedFilterYear = year;
    this.isYearDropdownOpen = false;
  }

  // Funciones de selección y visor
  isItemSelected(item: MediaItem): boolean {
    return this.selectedItems.some(selected => selected.id === item.id);
  }

onToggleSelect(event: {item: MediaItem, ctrlKey: boolean, shiftKey: boolean}): void {
  const {item, ctrlKey, shiftKey} = event;
  const clickedIndex = this.selectedAlbumPhotos.findIndex(i => i.id === item.id);
  
  if (shiftKey && this.lastClickedIndex !== null) {
    // 🎯 SHIFT + CLICK: Seleccionar rango ACUMULATIVO
    this.selectRangeAccumulative(this.lastClickedIndex, clickedIndex);
  } else if (ctrlKey) {
    // 🎯 CTRL + CLICK: Toggle individual
    const index = this.selectedItems.findIndex(i => i.id === item.id);
    if (index >= 0) {
      this.selectedItems.splice(index, 1);
    } else {
      this.selectedItems.push(item);
    }
    this.lastClickedIndex = clickedIndex;
  } else {
    // 🎯 CLICK NORMAL: Selección individual
    if (this.selectedItems.length === 1 && this.selectedItems[0].id === item.id) {
      this.selectedItems = [];
      this.lastClickedIndex = null;
    } else {
      this.selectedItems = [item];
      this.lastClickedIndex = clickedIndex;
    }
  }
}

// 🎯 NUEVA FUNCIÓN: Selección de rango acumulativa (profesional)
private selectRangeAccumulative(startIndex: number, endIndex: number): void {
  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);
  
  // 🎯 NO limpiar selección anterior, acumular rangos
  const rangeItems: MediaItem[] = [];
  
  // Seleccionar el rango nuevo
  for (let i = minIndex; i <= maxIndex; i++) {
    if (i >= 0 && i < this.selectedAlbumPhotos.length) {
      rangeItems.push(this.selectedAlbumPhotos[i]);
    }
  }
  
  // 🎯 ACUMULAR: Añadir elementos que no estén ya seleccionados
  rangeItems.forEach(item => {
    const alreadySelected = this.selectedItems.find(selected => selected.id === item.id);
    if (!alreadySelected) {
      this.selectedItems.push(item);
    }
  });
  
  // Actualizar último índice clickeado
  this.lastClickedIndex = endIndex;
  
  console.log(`Rango acumulado: ${minIndex}-${maxIndex} (${rangeItems.length} nuevos elementos, ${this.selectedItems.length} total)`);
}


// 🎯 ACTUALIZADA: onItemDoubleClick con lastClickedIndex
onItemDoubleClick(item: MediaItem): void {
  const index = this.selectedAlbumPhotos.findIndex(i => i.id === item.id);
  if (index >= 0) {
    this.lastClickedIndex = index; // ← AÑADIR ESTO
    
    // 🎯 GUARDAR POSICIÓN DE SCROLL ACTUAL DEL CONTENEDOR DE ÁLBUM
    const albumGallery = document.querySelector('.album-gallery') as HTMLElement;
    this.scrollPositionBeforeViewer = albumGallery ? albumGallery.scrollTop : 0;
    
    this.currentViewIndex = index;
    this.lastViewerIndex = index;
    this.isViewerOpen = true;
    
    // 🎯 PREVENIR SCROLL DEL BODY COMPLETAMENTE
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.width = '100%';
  }
}


ngOnChanges(changes: SimpleChanges): void {
  // 🎯 DETECTAR CUANDO selectedAlbumId se resetea o se establece
  if (changes['selectedAlbumId']) {
    const currentValue = changes['selectedAlbumId'].currentValue;
    
    if (currentValue) {
      // Cargar álbum específico
      this.albumService.getAlbums().subscribe(albums => {
        const album = albums.find(a => a.id === this.selectedAlbumId);
        if (album) {
          this.selectAlbum({
            ...album,
            coverPhotos: [],
            photoCount: 0
          });
        }
      });
    } else {
      // 🎯 RESETEAR ESTADO cuando selectedAlbumId es undefined/null
      this.goBackToAlbums();
    }
  }
}

  // 🎯 FUNCIÓN COMPLETA: closeViewer igual que galería
  closeViewer(): void {
    this.isViewerClosing = true;
    this.isViewerOpen = false;
    
    // 🎯 RESTAURAR SCROLL DEL BODY PRIMERO
    const scrollY = document.body.style.top;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    
    // 🎯 RESTAURAR POSICIÓN DE SCROLL DE LA VENTANA
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    // 🎯 ESPERAR A QUE EL DOM SE ACTUALICE ANTES DE HACER SCROLL AL ELEMENTO
    setTimeout(() => {
      this.scrollToTargetItem(this.lastViewerIndex);
    }, 50);
  }
  
  // 🎯 FUNCIÓN COMPLETA: onViewerIndexChanged
  onViewerIndexChanged(newIndex: number): void {
    this.lastViewerIndex = newIndex;
    this.currentViewIndex = newIndex;
  }
  
  // 🎯 FUNCIÓN COMPLETA: scrollToTargetItem
  private scrollToTargetItem(index: number): void {
    if (index < 0 || index >= this.selectedAlbumPhotos.length) {
      this.isViewerClosing = false;
      return;
    }
    
    const targetItem = this.selectedAlbumPhotos[index];
    if (!targetItem) {
      this.isViewerClosing = false;
      return;
    }
    
    // 🎯 BUSCAR EL ELEMENTO CON REINTENTOS MEJORADOS
    this.findAndScrollToElement(targetItem.id, 0);
  }
  
  // 🎯 FUNCIÓN COMPLETA: findAndScrollToElement
  private findAndScrollToElement(itemId: string, attempts: number): void {
    if (attempts > 15) {
      console.warn('No se pudo encontrar el elemento después de 15 intentos');
      this.isViewerClosing = false;
      return;
    }
    
    const targetElement = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement;
    
    if (targetElement && this.isElementVisible(targetElement)) {
      this.performScrollToElement(targetElement, itemId);
      this.isViewerClosing = false;
    } else {
      // 🎯 REINTENTAR CON DELAY PROGRESIVO
      const delay = Math.min(50 + (attempts * 25), 200);
      setTimeout(() => {
        this.findAndScrollToElement(itemId, attempts + 1);
      }, delay);
    }
  }
  
  // 🎯 FUNCIÓN COMPLETA: isElementVisible
  private isElementVisible(element: HTMLElement): boolean {
    return element.offsetParent !== null && 
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }
  
  // 🎯 FUNCIÓN COMPLETA: performScrollToElement adaptada para álbumes
  private performScrollToElement(targetElement: HTMLElement, itemId: string): void {
    const albumGallery = document.querySelector('.album-gallery') as HTMLElement;
    
    if (albumGallery) {
      // 🎯 CALCULAR POSICIÓN EXACTA
      const elementRect = targetElement.getBoundingClientRect();
      const containerRect = albumGallery.getBoundingClientRect();
      
      // 🎯 VERIFICAR SI ESTÁ VISIBLE EN EL VIEWPORT DEL CONTENEDOR
      const isInView = elementRect.top >= containerRect.top && 
                      elementRect.bottom <= containerRect.bottom;
      
      if (!isInView) {
        // 🎯 CALCULAR SCROLL TARGET
        const elementTop = targetElement.offsetTop;
        const containerHeight = albumGallery.offsetHeight;
        const elementHeight = targetElement.offsetHeight;
        
        // 🎯 CENTRAR EL ELEMENTO EN EL CONTENEDOR
        const scrollTarget = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        // 🎯 HACER SCROLL SUAVE
        albumGallery.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: 'smooth'
        });
      }
      
      // 🎯 SELECCIONAR EL ELEMENTO (usando el itemId)
      this.selectElementById(itemId);
    }
  }
  
  // 🎯 FUNCIÓN COMPLETA: selectElementById adaptada para álbumes
  private selectElementById(itemId: string): void {
    // 🎯 BUSCAR EL ITEM EN EL ARRAY DE FOTOS DEL ÁLBUM
    const targetItem = this.selectedAlbumPhotos.find(item => item.id === itemId);
    
    if (targetItem) {
      // 🎯 LIMPIAR SELECCIÓN ANTERIOR Y SELECCIONAR SOLO ESTE
      this.selectedItems = [targetItem];
      
      console.log('Elemento seleccionado después del scroll:', targetItem.id);
    }
  }

downloadSelected(): void {
  if (this.selectedItems.length === 0 || this.downloadInProgress) return;
  this.downloadInProgress = true;

  // 🎯 Solo un elemento seleccionado: descarga directa
  if (this.selectedItems.length === 1) {
    const item = this.selectedItems[0];
    const fileName = item.path.split('/').pop() || `item-${item.id}`;
    fetch(item.path)
      .then(response => response.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.downloadInProgress = false;
      })
      .catch(error => {
        console.error('Error descargando archivo:', error);
        this.downloadInProgress = false;
      });
    return;
  }

  // 🎯 Varios elementos: descargar ZIP
  const zip = new JSZip();
  let completed = 0;
  this.selectedItems.forEach(item => {
    fetch(item.path)
      .then(response => response.blob())
      .then(blob => {
        const fileName = item.path.split('/').pop() || `item-${item.id}`;
        zip.file(fileName, blob);
        completed++;
        if (completed === this.selectedItems.length) {
          zip.generateAsync({ type: 'blob' })
            .then((content: Blob) => {
              saveAs(content, `album_${this.selectedAlbum?.name || 'descarga'}_${new Date().toISOString().slice(0, 10)}.zip`);
              this.downloadInProgress = false;
            })
            .catch((error: Error) => {
              console.error('Error generando ZIP:', error);
              this.downloadInProgress = false;
            });
        }
      })
      .catch(error => {
        console.error(`Error descargando archivo:`, error);
        completed++;
        if (completed === this.selectedItems.length) {
          zip.generateAsync({ type: 'blob' })
            .then((content: Blob) => {
              saveAs(content, `album_${this.selectedAlbum?.name || 'descarga'}_${new Date().toISOString().slice(0, 10)}.zip`);
              this.downloadInProgress = false;
            })
            .catch((error: Error) => {
              console.error('Error generando ZIP:', error);
              this.downloadInProgress = false;
            });
        }
      });
  });
}

// onItemClick(item: MediaItem, index: number, event: MouseEvent): void {
//   // Shift+Click: seleccionar rango
//   if (event.shiftKey && this.lastClickedIndex !== null) {
//     const start = Math.min(this.lastClickedIndex, index);
//     const end = Math.max(this.lastClickedIndex, index);
//     const itemsInRange = this.selectedAlbumPhotos.slice(start, end + 1);

//     // Añade los del rango a la selección (sin duplicados)
//     const ids = new Set(this.selectedItems.map(i => i.id));
//     itemsInRange.forEach(i => {
//       if (!ids.has(i.id)) this.selectedItems.push(i);
//     });
//   } else {
//     // Click normal: selecciona solo este (o deselecciona si ya está)
//     if (this.selectedItems.length === 1 && this.selectedItems[0].id === item.id) {
//       this.selectedItems = [];
//     } else {
//       this.selectedItems = [item];
//     }
//     this.lastClickedIndex = index;
//   }
// }



  // Zoom
  onZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.zoomLevel = Number(input.value);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('albums-zoom-level', this.zoomLevel.toString());
    }
  }

selectAll(): void {
  if (this.selectedItems.length === this.selectedAlbumPhotos.length) {
    this.selectedItems = [];
    this.lastClickedIndex = null;
  } else {
    this.selectedItems = [...this.selectedAlbumPhotos];
    this.lastClickedIndex = this.selectedAlbumPhotos.length - 1;
  }
}

// 🎯 NUEVA FUNCIÓN: clearSelection con lastClickedIndex
clearSelection(): void {
  this.selectedItems = [];
  this.lastClickedIndex = null;
}

// 🎯 NUEVO: HostListener para atajos de teclado
@HostListener('document:keydown', ['$event'])
onKeyDown(event: KeyboardEvent): void {
  // Solo funcionar cuando hay álbum seleccionado
  if (!this.selectedAlbum) return;
  
  if (event.ctrlKey && event.key === 'a') {
    event.preventDefault();
    this.selectAll();
  }
  if (event.key === 'Escape') {
    this.clearSelection();
  }
  
  // 🎯 NUEVO: Soporte para selección con teclado
  if (event.shiftKey && event.key === 'ArrowUp' && this.lastClickedIndex !== null) {
    event.preventDefault();
    const newIndex = Math.max(0, this.lastClickedIndex - 1);
    this.selectRangeAccumulative(this.lastClickedIndex, newIndex);
  }
  
  if (event.shiftKey && event.key === 'ArrowDown' && this.lastClickedIndex !== null) {
    event.preventDefault();
    const newIndex = Math.min(this.selectedAlbumPhotos.length - 1, this.lastClickedIndex + 1);
    this.selectRangeAccumulative(this.lastClickedIndex, newIndex);
  }
}



  getImageResolution(): 'small' | 'medium' | 'large' {
    if (this.zoomLevel >= 7) {
      return 'small';
    } else if (this.zoomLevel >= 4) {
      return 'medium';
    } else {
      return 'large';
    }
  }

  // Utilidades
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private padArray<T>(array: T[], targetLength: number): (T | null)[] {
    const result: (T | null)[] = [...array];
    while (result.length < targetLength) {
      result.push(null);
    }
    return result;
  }
}
