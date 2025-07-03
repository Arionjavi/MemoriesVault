import { Component, OnInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaItemComponent } from '../media-item/media-item.component';
import { ImageViewerComponent } from '../image-viewer/image-viewer.component';
import { MediaService } from '../../services/media.service';
import { FavoriteService } from '../../services/favorite.service';
import { MediaItem } from '../../models/media-item.model';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MediaItemComponent,
    ImageViewerComponent
  ],
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.scss']
})
export class FavoritesComponent implements OnInit {
  favoriteItems: MediaItem[] = [];
  favoriteItemsFiltered: MediaItem[] = [];
  selectedItems: MediaItem[] = [];
  loading = false;
  zoomLevel = 6;
  downloadInProgress = false;

  // 🎯 PROPIEDADES PARA VISUALIZADOR Y SCROLL
  isViewerOpen = false;
  currentViewIndex = 0;
  private lastViewerIndex: number = 0;
  private scrollPositionBeforeViewer: number = 0;
  private isViewerClosing: boolean = false;

  // 🎯 NUEVA PROPIEDAD: Para selección por rangos
  lastClickedIndex: number | null = null;

  // Filtro por año
  availableYears: number[] = [];
  selectedFilterYear: number | null = null;
  isYearDropdownOpen = false;

  get itemsPerRow(): number {
    return this.zoomLevel;
  }

  constructor(
    private mediaService: MediaService,
    private favoriteService: FavoriteService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Cargar zoom guardado del localStorage para favoritos
    if (isPlatformBrowser(this.platformId)) {
      const savedZoom = localStorage.getItem('favorites-zoom-level');
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
    this.loadFavorites();
    this.favoriteService.favorites$.subscribe(() => {
      this.loadFavorites();
    });
  }

  loadFavorites(): void {
    this.loading = true;
    this.mediaService.getAllMediaItems().subscribe({
      next: (items) => {
        const favoriteIds = this.favoriteService.getFavoriteIds();
        this.favoriteItems = items.filter(item => favoriteIds.includes(item.id));
        this.selectedItems = this.selectedItems.filter(item => favoriteIds.includes(item.id));
        this.extractAvailableYears();
        this.applyYearFilter();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading favorites:', error);
        this.loading = false;
      }
    });
  }

  extractAvailableYears(): void {
    const yearsSet = new Set<number>();
    this.favoriteItems.forEach(item => {
      const year = this.getYear(item);
      if (year) yearsSet.add(year);
    });
    this.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
  }

  applyYearFilter(): void {
    if (this.selectedFilterYear) {
      this.favoriteItemsFiltered = this.favoriteItems.filter(item => this.getYear(item) === this.selectedFilterYear);
    } else {
      this.favoriteItemsFiltered = this.favoriteItems;
    }
  }

  // Filtro por año
  toggleYearDropdown(): void {
    this.isYearDropdownOpen = !this.isYearDropdownOpen;
  }

  filterByYear(year: number | null): void {
    this.selectedFilterYear = year;
    this.isYearDropdownOpen = false;
    this.applyYearFilter();
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

  getYear(item: MediaItem): number | null {
    if (!item.date) return null;
    const dateObj = new Date(item.date);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.getFullYear();
  }

  // 🎯 NUEVA FUNCIÓN: Selección por rangos con acumulación
  onToggleSelect(event: {item: MediaItem, ctrlKey: boolean, shiftKey: boolean}): void {
    const {item, ctrlKey, shiftKey} = event;
    const clickedIndex = this.favoriteItemsFiltered.findIndex(i => i.id === item.id);
    
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
      if (i >= 0 && i < this.favoriteItemsFiltered.length) {
        rangeItems.push(this.favoriteItemsFiltered[i]);
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

  // 🎯 FUNCIÓN COMPLETA: onItemDoubleClick con lastClickedIndex
  onItemDoubleClick(item: MediaItem): void {
    const index = this.favoriteItemsFiltered.findIndex(i => i.id === item.id);
    if (index >= 0) {
      this.lastClickedIndex = index; // ← MANTENER CONSISTENCIA
      
      // 🎯 GUARDAR POSICIÓN DE SCROLL ACTUAL DEL CONTENEDOR DE FAVORITOS
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
    if (index < 0 || index >= this.favoriteItemsFiltered.length) {
      this.isViewerClosing = false;
      return;
    }
    
    const targetItem = this.favoriteItemsFiltered[index];
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
  
  // 🎯 FUNCIÓN COMPLETA: performScrollToElement adaptada para favoritos
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
      
      // 🎯 SELECCIONAR EL ELEMENTO (usando el itemId)
      this.selectElementById(itemId);
    }
  }
  
  // 🎯 FUNCIÓN COMPLETA: selectElementById adaptada para favoritos
  private selectElementById(itemId: string): void {
    // 🎯 BUSCAR EL ITEM EN EL ARRAY DE FAVORITOS FILTRADOS
    const targetItem = this.favoriteItemsFiltered.find(item => item.id === itemId);
    
    if (targetItem) {
      // 🎯 LIMPIAR SELECCIÓN ANTERIOR Y SELECCIONAR SOLO ESTE
      this.selectedItems = [targetItem];
      
      console.log('Elemento seleccionado después del scroll:', targetItem.id);
    }
  }

  // Selección y descarga
  isItemSelected(item: MediaItem): boolean {
    return this.selectedItems.some(selected => selected.id === item.id);
  }

  downloadSelected(): void {
    if (this.selectedItems.length === 0 || this.downloadInProgress) return;
    this.downloadInProgress = true;

    // 🎯 Solo una imagen/video seleccionado: descarga directa
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

    // 🎯 Varias imágenes/videos: descarga ZIP
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
                saveAs(content, `favoritos_${new Date().toISOString().slice(0, 10)}.zip`);
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
                saveAs(content, `favoritos_${new Date().toISOString().slice(0, 10)}.zip`);
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

  // 🎯 ACTUALIZADO: clearSelection con lastClickedIndex
  clearSelection(): void {
    this.selectedItems = [];
    this.lastClickedIndex = null;
  }

  // 🎯 ACTUALIZADO: selectAll con lastClickedIndex
  selectAll(): void {
    if (this.selectedItems.length === this.favoriteItemsFiltered.length) {
      // Si ya están todos seleccionados, deselecciona todo
      this.selectedItems = [];
      this.lastClickedIndex = null;
    } else {
      // Si no, selecciona todos los filtrados
      this.selectedItems = [...this.favoriteItemsFiltered];
      this.lastClickedIndex = this.favoriteItemsFiltered.length - 1;
    }
  }

  onZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.zoomLevel = Number(input.value);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('favorites-zoom-level', this.zoomLevel.toString());
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

  // 🎯 NUEVO: HostListener para atajos de teclado
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
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
      const newIndex = Math.min(this.favoriteItemsFiltered.length - 1, this.lastClickedIndex + 1);
      this.selectRangeAccumulative(this.lastClickedIndex, newIndex);
    }
  }
}
