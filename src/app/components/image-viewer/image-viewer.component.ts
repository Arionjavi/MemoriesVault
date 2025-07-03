import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaItem } from '../../models/media-item.model';
import { FavoriteService } from '../../services/favorite.service';

interface VirtualThumbnail {
  item: MediaItem;
  index: number;
  left: number;
  isVisible: boolean;
  isLoaded: boolean;
   src?: string;
}

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-viewer.component.html',
  styleUrls: ['./image-viewer.component.scss']
})
export class ImageViewerComponent implements AfterViewInit, OnDestroy {
  @Input() items: MediaItem[] = [];
  @Input() currentIndex: number = 0;
  @Output() closeViewer = new EventEmitter<void>();
  @Output() indexChanged = new EventEmitter<number>();
    private imageUrlCache: Map<string, string> = new Map();
  private loadingQueue: Set<string> = new Set();
  @ViewChild('thumbnailsContainer') thumbnailsContainer!: ElementRef;
  @ViewChild('imageContainer') imageContainer!: ElementRef;
  @ViewChild('mainImage') mainImage!: ElementRef;
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  
  // Propiedades de zoom
  zoomLevel: number = 1;
  minZoom: number = 0.5;
  maxZoom: number = 3;
  isDraggingImage: boolean = false;
  startX: number = 0;
  startY: number = 0;
  currentX: number = 0;
  currentY: number = 0;
  isVideoHorizontal: boolean = true;
  
  // Propiedades del slider optimizado
  isDraggingSlider: boolean = false;
  sliderStartX: number = 0;
  sliderScrollLeft: number = 0;
  
  // 🎯 VIRTUALIZACIÓN MEJORADA
  thumbnailWidth: number = 96;
  containerWidth: number = 0;
  visibleThumbnails: VirtualThumbnail[] = [];
  maxVisibleItems: number = 15;
  bufferSize: number = 5; // Aumentado para mejor precarga
  
  // 🎯 LAZY LOADING MEJORADO
  private intersectionObserver!: IntersectionObserver;
  private loadedImages: Set<string> = new Set();
  private imageCache: Map<string, HTMLImageElement> = new Map();
  
  // 🎯 CONTROL DE SCROLL PARA FORZAR CARGA
  private scrollTimeout: any;
  private lastScrollPosition: number = 0;
  
  // Propiedades del video
  isVideoPlaying: boolean = false;
  isVideoMuted: boolean = false;
  videoVolume: number = 1;
  videoCurrentTime: number = 0;
  videoDuration: number = 0;
  
  get currentItem(): MediaItem {
    return this.items[this.currentIndex];
  }
  
  get isVideo(): boolean {
    return this.currentItem?.type === 'video';
  }
  
  constructor(private favoriteService: FavoriteService) {}
  
  ngAfterViewInit() {
    this.initializeViewer();
  }
  
  ngOnDestroy() {
    this.cleanupViewer();
  }
  
  // 🎯 INICIALIZACIÓN MEJORADA
  private initializeViewer(): void {
    this.calculateContainerWidth();
    this.setupIntersectionObserver();
    this.updateVisibleThumbnails();
    this.scrollThumbnailIntoView();
    this.setupVideoListeners();
    
    // 🎯 FORZAR CARGA INICIAL
    setTimeout(() => {
      this.forceLoadVisibleThumbnails();
    }, 200);
    
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  // 🎯 CLEANUP MEJORADO
  private cleanupViewer(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.imageCache.clear();
    this.loadedImages.clear();
    this.loadingQueue.clear();
  }
  
  // 🎯 INTERSECTION OBSERVER MEJORADO
  private setupIntersectionObserver(): void {
    const options = {
      root: this.thumbnailsContainer?.nativeElement,
      rootMargin: '150px', // Aumentado para mejor precarga
      threshold: [0, 0.1, 0.5] // Múltiples umbrales
    };
    
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const thumbnail = entry.target as HTMLElement;
        const index = parseInt(thumbnail.dataset['index'] || '0');
        const item = this.items[index];
        
        if (entry.isIntersecting && item && !this.loadedImages.has(item.path) && !this.loadingQueue.has(item.path)) {
          this.loadThumbnailImage(thumbnail, item);
        }
      });
    }, options);
  }
  
  private async loadThumbnailImage(element: HTMLElement, item: MediaItem): Promise<void> {
    // 🎯 VERIFICAR CACHÉ PRIMERO
    if (this.imageUrlCache.has(item.path)) {
      const img = element.querySelector('.thumbnail-image') as HTMLImageElement;
      img.src = this.imageUrlCache.get(item.path)!;
      img.classList.add('loaded');
      return;
    }
    
    if (this.loadingQueue.has(item.path)) return;
    this.loadingQueue.add(item.path);

    try {
      let imageSrc = item.type === 'video' 
        ? await this.generateVideoThumbnail(item.path)
        : item.path;

      // 🎯 ALMACENAR EN CACHÉ
      this.imageUrlCache.set(item.path, imageSrc);

      const img = element.querySelector('.thumbnail-image') as HTMLImageElement;
      if (img) {
        img.src = imageSrc;
        img.classList.add('loaded');
      }

      // 🎯 ACTUALIZAR VIRTUAL THUMBNAIL
      const virtualItem = this.visibleThumbnails.find(v => v.item.path === item.path);
      if (virtualItem) {
        virtualItem.isLoaded = true;
        virtualItem.src = imageSrc;
      }
    } catch (error) {
      console.warn('Error cargando miniatura:', error);
    } finally {
      this.loadingQueue.delete(item.path);
    }
  }
  
  // 🎯 NUEVA FUNCIÓN: Cargar imagen con Promise
  private loadImageWithPromise(img: HTMLImageElement, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        img.src = src;
        img.classList.add('loaded');
        resolve();
      };
      tempImg.onerror = reject;
      tempImg.src = src;
    });
  }
  
  // 🎯 NUEVA FUNCIÓN: Forzar carga de miniaturas visibles
  private forceLoadVisibleThumbnails(): void {
    if (!this.thumbnailsContainer) return;
    
    const container = this.thumbnailsContainer.nativeElement;
    const thumbnails = container.querySelectorAll('.thumbnail[data-index]');
    
    thumbnails.forEach((thumbnail: HTMLElement) => {
      const rect = thumbnail.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Verificar si está visible en el contenedor
      if (rect.left < containerRect.right && rect.right > containerRect.left) {
        const index = parseInt(thumbnail.dataset['index'] || '0');
        const item = this.items[index];
        
        if (item && !this.loadedImages.has(item.path) && !this.loadingQueue.has(item.path)) {
          this.loadThumbnailImage(thumbnail, item);
        }
      }
    });
  }
  
  // 🎯 GENERAR MINIATURA DE VIDEO OPTIMIZADO
  private async generateVideoThumbnail(videoPath: string): Promise<string> {
    if (this.imageCache.has(videoPath)) {
      const cachedImg = this.imageCache.get(videoPath);
      return cachedImg?.src || '';
    }
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';
      
      const timeout = setTimeout(() => {
        video.remove();
        reject('Timeout generando miniatura');
      }, 10000); // 10 segundos timeout
      
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(video.duration * 0.1, 2);
      };
      
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = 160;
          canvas.height = 120;
          
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            const img = new Image();
            img.src = thumbnailUrl;
            this.imageCache.set(videoPath, img);
            
            clearTimeout(timeout);
            resolve(thumbnailUrl);
          } else {
            clearTimeout(timeout);
            reject('No se pudo crear contexto canvas');
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        } finally {
          video.remove();
        }
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        reject('Error cargando video');
        video.remove();
      };
      
      video.src = videoPath;
    });
  }
  
  private calculateContainerWidth(): void {
    if (this.thumbnailsContainer) {
      this.containerWidth = this.thumbnailsContainer.nativeElement.offsetWidth;
      this.maxVisibleItems = Math.ceil(this.containerWidth / this.thumbnailWidth) + (this.bufferSize * 2);
    }
  }
  
  // 🎯 ACTUALIZAR MINIATURAS VISIBLES MEJORADO
  private updateVisibleThumbnails(): void {
    if (!this.thumbnailsContainer || !this.items.length) return;
    
    const scrollLeft = this.thumbnailsContainer.nativeElement.scrollLeft;
    const startIndex = Math.max(0, Math.floor(scrollLeft / this.thumbnailWidth) - this.bufferSize);
    const endIndex = Math.min(this.items.length, startIndex + this.maxVisibleItems);
    
    this.visibleThumbnails = [];
    
    for (let i = startIndex; i < endIndex; i++) {
      const isLoaded = this.imageUrlCache.has(this.items[i].path);
      this.visibleThumbnails.push({
        item: this.items[i],
        index: i,
        left: i * this.thumbnailWidth,
        isVisible: true,
        isLoaded: isLoaded,
        src: isLoaded ? this.imageUrlCache.get(this.items[i].path) : undefined // 🎯 AÑADIR URL
      });
    }
  }
  
  getTotalSliderWidth(): number {
    return this.items.length * this.thumbnailWidth;
  }
  
  // 🎯 MANEJAR SCROLL MEJORADO
  onThumbnailScroll(): void {
    const currentScrollPosition = this.thumbnailsContainer.nativeElement.scrollLeft;
    
    // 🎯 DETECTAR CAMBIO DE SCROLL SIGNIFICATIVO
    if (Math.abs(currentScrollPosition - this.lastScrollPosition) > 50) {
      this.updateVisibleThumbnails();
      
      // 🎯 FORZAR CARGA DESPUÉS DE UN BREVE DELAY
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      
      this.scrollTimeout = setTimeout(() => {
        this.forceLoadVisibleThumbnails();
        
        // 🎯 OBSERVAR NUEVOS ELEMENTOS
        setTimeout(() => {
          const thumbnails = this.thumbnailsContainer.nativeElement.querySelectorAll('.thumbnail[data-index]');
          thumbnails.forEach((thumb: HTMLElement) => {
            if (thumb.dataset['observed'] !== 'true') {
              this.intersectionObserver.observe(thumb);
              thumb.dataset['observed'] = 'true';
            }
          });
        }, 100);
      }, 150);
      
      this.lastScrollPosition = currentScrollPosition;
    }
  }
  
  trackByIndex(index: number, item: VirtualThumbnail): number {
    return item.index;
  }
  
  private onWindowResize(): void {
    this.calculateContainerWidth();
    this.updateVisibleThumbnails();
    setTimeout(() => this.forceLoadVisibleThumbnails(), 100);
  }
  
// 🎯 MODIFICAR: setupVideoListeners para mejor gestión
setupVideoListeners(): void {
  if (this.videoPlayer && this.isVideo) {
    const video = this.videoPlayer.nativeElement;
    
    // 🎯 LIMPIAR LISTENERS ANTERIORES
    video.removeEventListener('loadedmetadata', this.onVideoLoadedMetadata);
    video.removeEventListener('timeupdate', this.onVideoTimeUpdate);
    video.removeEventListener('play', this.onVideoPlay);
    video.removeEventListener('pause', this.onVideoPause);
    video.removeEventListener('volumechange', this.onVideoVolumeChange);
    
    // 🎯 AÑADIR NUEVOS LISTENERS
    video.addEventListener('loadedmetadata', this.onVideoLoadedMetadata.bind(this));
    video.addEventListener('timeupdate', this.onVideoTimeUpdate.bind(this));
    video.addEventListener('play', this.onVideoPlay.bind(this));
    video.addEventListener('pause', this.onVideoPause.bind(this));
    video.addEventListener('volumechange', this.onVideoVolumeChange.bind(this));
  }
}

// 🎯 FUNCIONES DE CALLBACK SEPARADAS PARA MEJOR GESTIÓN
private onVideoLoadedMetadata(): void {
  if (this.videoPlayer) {
    const video = this.videoPlayer.nativeElement;
    this.videoDuration = video.duration;
    this.isVideoHorizontal = video.videoWidth > video.videoHeight;
  }
}

private onVideoTimeUpdate(): void {
  if (this.videoPlayer) {
    const video = this.videoPlayer.nativeElement;
    this.videoCurrentTime = video.currentTime;
  }
}

private onVideoPlay(): void {
  this.isVideoPlaying = true;
}

private onVideoPause(): void {
  this.isVideoPlaying = false;
}

private onVideoVolumeChange(): void {
  if (this.videoPlayer) {
    const video = this.videoPlayer.nativeElement;
    this.videoVolume = video.volume;
    this.isVideoMuted = video.muted;
  }
}



  getVideoMimeType(item?: MediaItem): string {
    const mediaItem = item || this.currentItem;
    const extension = mediaItem.extension?.toLowerCase();
    switch (extension) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mov': return 'video/quicktime';
      case 'avi': return 'video/x-msvideo';
      case 'mkv': return 'video/x-matroska';
      default: return 'video/mp4';
    }
  }
  
  // 🎯 MODIFICAR: Emitir índice al cerrar
  close(): void {
    this.indexChanged.emit(this.currentIndex);
    this.closeViewer.emit();
  }
  
  downloadImage(): void {
    const link = document.createElement('a');
    link.href = this.currentItem.path;
    link.download = this.currentItem.path.split('/').pop() || 'media';
    link.click();
  }
  
  toggleFavorite(event: Event): void {
    event.stopPropagation();
    this.favoriteService.toggleFavorite(this.currentItem.id);
  }
  
  isFavorite(): boolean {
    return this.favoriteService.isFavorite(this.currentItem.id);
  }
  
// 🎯 MODIFICAR: navToPrev para forzar recarga de video
navToPrev(): void {
  if (this.hasPrevious()) {
    const wasVideo = this.isVideo;
    this.currentIndex--;
    
    // 🎯 SI ES VIDEO, FORZAR RECARGA
    if (this.isVideo || wasVideo) {
      setTimeout(() => {
        this.reloadVideo();
      }, 50);
    }
    
    this.resetZoom();
    this.scrollThumbnailIntoView();
    this.setupVideoListeners();
    this.indexChanged.emit(this.currentIndex);
  }
}
  
// 🎯 MODIFICAR: onVideoLoaded (mantener para compatibilidad)
onVideoLoaded(): void {
  this.onVideoLoadedMetadata();
}
  
// 🎯 MODIFICAR: navToNext para forzar recarga de video
navToNext(): void {
  if (this.hasNext()) {
    const wasVideo = this.isVideo;
    this.currentIndex++;
    
    // 🎯 SI ES VIDEO, FORZAR RECARGA
    if (this.isVideo || wasVideo) {
      setTimeout(() => {
        this.reloadVideo();
      }, 50);
    }
    
    this.resetZoom();
    this.scrollThumbnailIntoView();
    this.setupVideoListeners();
    this.indexChanged.emit(this.currentIndex);
  }
}

// 🎯 NUEVA FUNCIÓN: Forzar recarga del video
private reloadVideo(): void {
  if (this.videoPlayer && this.isVideo) {
    const video = this.videoPlayer.nativeElement;
    
    try {
      // 🎯 PAUSAR VIDEO ACTUAL
      video.pause();
      
      // 🎯 RESETEAR TIEMPO
      video.currentTime = 0;
      
      // 🎯 ACTUALIZAR SOURCE Y FORZAR RECARGA
      const source = video.querySelector('source');
      if (source) {
        source.src = this.currentItem.path;
        source.type = this.getVideoMimeType();
      }
      
      // 🎯 FORZAR RECARGA DEL VIDEO
      video.load();
      
      // 🎯 CONFIGURAR LISTENERS DESPUÉS DE CARGAR
      setTimeout(() => {
        this.setupVideoListeners();
      }, 100);
      
    } catch (error) {
      console.warn('Error recargando video:', error);
    }
  }
}
  
  hasPrevious(): boolean {
    return this.currentIndex > 0;
  }
  
  hasNext(): boolean {
    return this.currentIndex < this.items.length - 1;
  }
  
// 🎯 MODIFICAR: selectItem para forzar recarga de video
selectItem(index: number): void {
  console.log('Selecting item at index:', index, 'Type:', this.items[index]?.type);
  
  if (index >= 0 && index < this.items.length) {
    const previousIndex = this.currentIndex;
    this.currentIndex = index;
    
    // 🎯 SI CAMBIÓ A UN VIDEO, FORZAR RECARGA
    if (this.isVideo && previousIndex !== index) {
      setTimeout(() => {
        this.reloadVideo();
      }, 50);
    }
    
    this.resetZoom();
    this.scrollThumbnailIntoView();
    this.setupVideoListeners();
    this.indexChanged.emit(this.currentIndex);
  }
}
  
  scrollThumbnailIntoView(): void {
    setTimeout(() => {
      if (this.thumbnailsContainer) {
        const container = this.thumbnailsContainer.nativeElement;
        const targetPosition = this.currentIndex * this.thumbnailWidth - (this.containerWidth / 2) + (this.thumbnailWidth / 2);
        
        container.scrollTo({
          left: Math.max(0, targetPosition),
          behavior: 'smooth'
        });
        
        setTimeout(() => {
          this.updateVisibleThumbnails();
          this.forceLoadVisibleThumbnails();
        }, 100);
      }
    }, 50);
  }
  
  onThumbnailWheel(event: WheelEvent): void {
    event.preventDefault();
    const container = this.thumbnailsContainer.nativeElement;
    const SCROLL_SPEED = 320;
    container.scrollLeft += event.deltaY > 0 ? SCROLL_SPEED : -SCROLL_SPEED;
    
    // 🎯 FORZAR ACTUALIZACIÓN DESPUÉS DEL WHEEL
    setTimeout(() => this.onThumbnailScroll(), 50);
  }

  startDragImage(event: MouseEvent): void {
    if (this.isVideo || this.zoomLevel <= 1) return;
    
    this.isDraggingImage = true;
    this.startX = event.clientX - this.currentX;
    this.startY = event.clientY - this.currentY;
    
    if (this.imageContainer) {
      this.imageContainer.nativeElement.style.cursor = 'grabbing';
    }
    
    event.preventDefault();
    event.stopPropagation();
    document.body.style.userSelect = 'none';
  }

  onDragImage(event: MouseEvent): void {
    if (!this.isDraggingImage) return;
    event.preventDefault();
    event.stopPropagation();
    
    this.currentX = event.clientX - this.startX;
    this.currentY = event.clientY - this.startY;
  }

  onMouseWheel(event: WheelEvent): void {
    if (this.isVideo) return;
    event.preventDefault();
    
    const zoomDirection = event.deltaY < 0 ? 1 : -1;
    let newZoom = this.zoomLevel + (zoomDirection * 0.15);
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    if (newZoom > this.zoomLevel && this.mainImage) {
      const rect = this.mainImage.nativeElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const x = (mouseX - rect.width / 2) * (newZoom - this.zoomLevel);
      const y = (mouseY - rect.height / 2) * (newZoom - this.zoomLevel);

      this.currentX -= x;
      this.currentY -= y;
    }

    if (newZoom <= 1) {
      this.currentX = 0;
      this.currentY = 0;
    }

    this.zoomLevel = newZoom;
  }
  
  stopDragImage(): void {
    this.isDraggingImage = false;
    if (this.imageContainer) {
      this.imageContainer.nativeElement.style.cursor = this.zoomLevel > 1 ? 'grab' : 'default';
    }
    document.body.style.userSelect = 'auto';
  }

// 🎯 MODIFICAR: startDragSlider para mejor detección
startDragSlider(event: MouseEvent): void {
  // 🎯 VERIFICAR QUE NO SEA UN CLICK EN THUMBNAIL
  const target = event.target as HTMLElement;
  const thumbnailElement = target.closest('.thumbnail');
  
  if (thumbnailElement) {
    // Si es un click en thumbnail, no iniciar drag
    return;
  }
  
  this.isDraggingSlider = true;
  this.sliderStartX = event.pageX;
  this.sliderScrollLeft = this.thumbnailsContainer.nativeElement.scrollLeft;
  this.thumbnailsContainer.nativeElement.classList.add('dragging');
  
  event.preventDefault();
  document.body.style.userSelect = 'none';
}

// 🎯 MODIFICAR: onDragSlider para mejor control
onDragSlider(event: MouseEvent): void {
  if (!this.isDraggingSlider) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const x = event.pageX;
  const walk = (x - this.sliderStartX) * 2;
  this.thumbnailsContainer.nativeElement.scrollLeft = this.sliderScrollLeft - walk;
}

// 🎯 MEJORAR: onVideoOverlayClick con mejor debugging
onVideoOverlayClick(event: Event, index: number): void {
  event.preventDefault();
  event.stopPropagation();
  
  console.log('Video overlay clicked:', index, 'Current:', this.currentIndex);
  
  // 🎯 ASEGURAR QUE SE SELECCIONE EL ITEM CORRECTO
  this.selectItem(index);
}

// 🎯 NUEVA FUNCIÓN: Manejar mousedown en overlay de video
onVideoOverlayMouseDown(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

// 🎯 MEJORAR: onThumbnailMouseDown
onThumbnailMouseDown(event: Event): void {
  // Solo prevenir si no estamos arrastrando el slider
  if (!this.isDraggingSlider) {
    event.stopPropagation();
  }
}

  stopDragSlider(): void {
    this.isDraggingSlider = false;
    this.thumbnailsContainer.nativeElement.classList.remove('dragging');
    document.body.style.userSelect = 'auto';
    
    // 🎯 FORZAR ACTUALIZACIÓN DESPUÉS DEL DRAG
    setTimeout(() => this.onThumbnailScroll(), 100);
  }
  
  resetZoom(): void {
    this.zoomLevel = 1;
    this.currentX = 0;
    this.currentY = 0;
  }
  
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    switch(event.key) {
      case 'ArrowLeft':
        this.navToPrev();
        break;
      case 'ArrowRight':
        this.navToNext();
        break;
      case 'Escape':
        this.close();
        break;
      case ' ':
        if (this.isVideo && this.videoPlayer) {
          event.preventDefault();
          const video = this.videoPlayer.nativeElement;
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
        }
        break;
    }
  }
}
