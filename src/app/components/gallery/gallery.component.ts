import { Component, OnInit, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { FormsModule } from '@angular/forms';
import { MediaItemComponent } from '../media-item/media-item.component';
import { ImageViewerComponent } from '../image-viewer/image-viewer.component';
import { MediaItem } from '../../models/media-item.model';
import { MediaService } from '../../services/media.service';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface YearGroup {
  year: number;
  items: MediaItem[];
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InfiniteScrollModule,
    MediaItemComponent,
    ImageViewerComponent
  ],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss']
})
export class GalleryComponent implements OnInit {
  mediaItems: MediaItem[] = [];
  yearGroups: YearGroup[] = [];
  selectedItems: MediaItem[] = [];
  loading = false;
  currentYear: number | null = null;
  downloadInProgress = false;

  // 🎯 PROPIEDADES PARA VISUALIZADOR Y SCROLL
  isViewerOpen = false;
  currentViewIndex = 0;
  private lastViewerIndex: number = 0;
  private scrollPositionBeforeViewer: number = 0;
  private isViewerClosing: boolean = false;

  // 🎯 PROPIEDAD PARA SELECCIÓN POR RANGOS
  lastClickedIndex: number | null = null;

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
    private mediaService: MediaService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedZoom = localStorage.getItem('gallery-zoom-level');
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
    this.loadAllMedia();
  }

  loadAllMedia(): void {
    this.loading = true;
    this.mediaService.getAllMediaItems().subscribe({
      next: (items) => {
        this.mediaItems = items;
        if (items && items.length > 0) {
          const mostRecentDate = new Date(items[0].date);
          this.currentYear = mostRecentDate.getFullYear();
          this.groupItemsByYear(items);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading media:', error);
        this.loading = false;
      }
    });
  }

  private groupItemsByYear(items: MediaItem[]): void {
    this.yearGroups = [];
    const yearMap = new Map<number, MediaItem[]>();
    items.forEach(item => {
      if (!item.date) return;
      const dateObj = new Date(item.date);
      if (isNaN(dateObj.getTime())) return;
      const year = dateObj.getFullYear();
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)?.push(item);
    });
    const years = Array.from(yearMap.keys()).sort((a, b) => b - a);
    this.yearGroups = years.map(year => ({
      year,
      items: yearMap.get(year) || []
    }));
    this.availableYears = years;
  }

  // Filtro por año
  toggleYearDropdown(): void {
    this.isYearDropdownOpen = !this.isYearDropdownOpen;
  }

  filterByYear(year: number | null): void {
    this.selectedFilterYear = year;
    this.isYearDropdownOpen = false;
    if (year) this.scrollToYear(year);
  }

  scrollToYear(year: number): void {
    if (isPlatformBrowser(this.platformId)) {
      const yearElement = document.getElementById(`year-${year}`);
      if (yearElement) {
        yearElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  }

  // 🎯 SELECCIÓN POR RANGOS ACUMULATIVA (igual que Favorites)
  onToggleSelect(event: {item: MediaItem, ctrlKey: boolean, shiftKey: boolean}): void {
    const {item, ctrlKey, shiftKey} = event;
    const clickedIndex = this.mediaItems.findIndex(i => i.id === item.id);
    
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

  // 🎯 FUNCIÓN DE RANGO ACUMULATIVO (igual que Favorites)
  private selectRangeAccumulative(startIndex: number, endIndex: number): void {
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    // 🎯 NO limpiar selección anterior, acumular rangos
    const rangeItems: MediaItem[] = [];
    
    // Seleccionar el rango nuevo
    for (let i = minIndex; i <= maxIndex; i++) {
      if (i >= 0 && i < this.mediaItems.length) {
        rangeItems.push(this.mediaItems[i]);
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

  // Selección y visor
  isItemSelected(item: MediaItem): boolean {
    return this.selectedItems.some(selected => selected.id === item.id);
  }

  // 🎯 DOBLE CLICK CON LASTCLICKEDINDEX
  onItemDoubleClick(item: MediaItem): void {
    const index = this.mediaItems.findIndex(i => i.id === item.id);
    if (index >= 0) {
      this.lastClickedIndex = index; // ← MANTENER CONSISTENCIA
      
      // 🎯 GUARDAR POSICIÓN DE SCROLL ACTUAL
      const galleryContainer = document.querySelector('.gallery-container') as HTMLElement;
      this.scrollPositionBeforeViewer = galleryContainer ? galleryContainer.scrollTop : 0;
      
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

  // 🎯 CERRAR VISOR (igual que Favorites)
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
  
  // 🎯 CAMBIO DE ÍNDICE DEL VISOR
  onViewerIndexChanged(newIndex: number): void {
    this.lastViewerIndex = newIndex;
    this.currentViewIndex = newIndex;
  }
  
  // 🎯 SCROLL AL ELEMENTO OBJETIVO
  private scrollToTargetItem(index: number): void {
    if (index < 0 || index >= this.mediaItems.length) {
      this.isViewerClosing = false;
      return;
    }
    
    const targetItem = this.mediaItems[index];
    if (!targetItem) {
      this.isViewerClosing = false;
      return;
    }
    
    // 🎯 BUSCAR EL ELEMENTO CON REINTENTOS MEJORADOS
    this.findAndScrollToElement(targetItem.id, 0);
  }
  
  // 🎯 BUSCAR Y HACER SCROLL AL ELEMENTO
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
  
  // 🎯 VERIFICAR SI EL ELEMENTO ES VISIBLE
  private isElementVisible(element: HTMLElement): boolean {
    return element.offsetParent !== null && 
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }
  
  // 🎯 HACER SCROLL AL ELEMENTO
  private performScrollToElement(targetElement: HTMLElement, itemId: string): void {
    const galleryContainer = document.querySelector('.gallery-container') as HTMLElement;
    
    if (galleryContainer) {
      // 🎯 CALCULAR POSICIÓN EXACTA
      const elementRect = targetElement.getBoundingClientRect();
      const containerRect = galleryContainer.getBoundingClientRect();
      
      // 🎯 VERIFICAR SI ESTÁ VISIBLE EN EL VIEWPORT DEL CONTENEDOR
      const isInView = elementRect.top >= containerRect.top && 
                      elementRect.bottom <= containerRect.bottom;
      
      if (!isInView) {
        // 🎯 CALCULAR SCROLL TARGET
        const elementTop = targetElement.offsetTop;
        const containerHeight = galleryContainer.offsetHeight;
        const elementHeight = targetElement.offsetHeight;
        
        // 🎯 CENTRAR EL ELEMENTO EN EL CONTENEDOR
        const scrollTarget = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        // 🎯 HACER SCROLL SUAVE
        galleryContainer.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: 'smooth'
        });
      }
      
      // 🎯 SELECCIONAR EL ELEMENTO
      this.selectElementById(itemId);
    }
  }
  
  // 🎯 SELECCIONAR ELEMENTO POR ID
  private selectElementById(itemId: string): void {
    // 🎯 BUSCAR EL ITEM EN EL ARRAY
    const targetItem = this.mediaItems.find(item => item.id === itemId);
    
    if (targetItem) {
      // 🎯 LIMPIAR SELECCIÓN ANTERIOR Y SELECCIONAR SOLO ESTE
      this.selectedItems = [targetItem];
      
      console.log('Elemento seleccionado después del scroll:', targetItem.id);
    }
  }

  // 🎯 DESCARGA DE ARCHIVOS SELECCIONADOS
  downloadSelected(): void {
    if (this.selectedItems.length === 0 || this.downloadInProgress) return;
    this.downloadInProgress = true;

    // 🎯 Solo una imagen seleccionada: descarga directa
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

    // 🎯 Varias imágenes: descarga ZIP
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
                saveAs(content, `seleccion_${new Date().toISOString().slice(0, 10)}.zip`);
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
                saveAs(content, `seleccion_${new Date().toISOString().slice(0, 10)}.zip`);
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

  // 🎯 SELECCIONAR TODOS CON LASTCLICKEDINDEX
  selectAll(): void {
    if (this.selectedItems.length === this.mediaItems.length) {
      // Si ya están todos seleccionados, deselecciona todo
      this.selectedItems = [];
      this.lastClickedIndex = null;
    } else {
      // Si no, selecciona todos
      this.selectedItems = [...this.mediaItems];
      this.lastClickedIndex = this.mediaItems.length - 1;
    }
  }

  // 🎯 LIMPIAR SELECCIÓN CON LASTCLICKEDINDEX
  clearSelection(): void {
    this.selectedItems = [];
    this.lastClickedIndex = null;
  }

  onZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.zoomLevel = Number(input.value);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('gallery-zoom-level', this.zoomLevel.toString());
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

  // 🎯 ATAJOS DE TECLADO
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      this.selectAll();
    }
    if (event.key === 'Escape') {
      this.clearSelection();
    }
    
    // 🎯 SOPORTE PARA SELECCIÓN CON TECLADO
    if (event.shiftKey && event.key === 'ArrowUp' && this.lastClickedIndex !== null) {
      event.preventDefault();
      const newIndex = Math.max(0, this.lastClickedIndex - 1);
      this.selectRangeAccumulative(this.lastClickedIndex, newIndex);
    }
    
    if (event.shiftKey && event.key === 'ArrowDown' && this.lastClickedIndex !== null) {
      event.preventDefault();
      const newIndex = Math.min(this.mediaItems.length - 1, this.lastClickedIndex + 1);
      this.selectRangeAccumulative(this.lastClickedIndex, newIndex);
    }
  }

  onScroll(): void {
    // No necesario, pero puedes implementar paginación si lo deseas
  }
}
