import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaItem } from '../../models/media-item.model';
import { FavoriteService } from '../../services/favorite.service';

@Component({
  selector: 'app-media-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-item.component.html',
  styleUrls: ['./media-item.component.scss']
})
export class MediaItemComponent implements OnInit {
  @Input() item!: MediaItem;
  @Input() resolution: 'small' | 'medium' | 'large' = 'medium';
  @Input() isSelected: boolean = false;
@Output() toggleSelect = new EventEmitter<{item: MediaItem, ctrlKey: boolean, shiftKey: boolean}>();
  @Output() itemDoubleClick = new EventEmitter<void>();
  
  isVideo: boolean = false;
  videoLoaded: boolean = false;
  generatedThumbnail: string = '';
  
  constructor(private favoriteService: FavoriteService) {}
  
  ngOnInit(): void {
    this.isVideo = this.item.type === 'video';
  }
  
  getImagePath(): string {
    if (!this.item.path) return '';
    
    // Para imágenes, retornar el path directo
    if (!this.isVideo) {
      return this.item.path;
    }
    
    // Para videos, usar thumbnail si existe
    if (this.item.thumbnail) {
      return this.item.thumbnail;
    }
    
    // Fallback para videos sin thumbnail
    return '';
  }
  
  getVideoMimeType(): string {
    const extension = this.item.extension?.toLowerCase();
    switch (extension) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mov': return 'video/quicktime';
      case 'avi': return 'video/x-msvideo';
      default: return 'video/mp4';
    }
  }
  
  // Generar thumbnail desde video usando Canvas
  generateThumbnail(videoElement: HTMLVideoElement): void {
    if (this.item.thumbnail || this.generatedThumbnail) return;
    
    videoElement.addEventListener('loadeddata', () => {
      try {
        // Crear canvas para extraer frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          
          // Ir al primer segundo del video
          videoElement.currentTime = 1;
          
          videoElement.addEventListener('seeked', () => {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            this.generatedThumbnail = canvas.toDataURL('image/jpeg', 0.8);
            this.videoLoaded = true;
          }, { once: true });
        }
      } catch (error) {
        console.warn('No se pudo generar thumbnail para:', this.item.name, error);
        this.videoLoaded = true;
      }
    }, { once: true });
    
    // Fallback si no puede cargar
    setTimeout(() => {
      if (!this.videoLoaded) {
        this.videoLoaded = true;
      }
    }, 3000);
  }
  
  get isFavorite(): boolean {
    return this.favoriteService.isFavorite(this.item.id);
  }
  
  toggleFavorite(event: Event): void {
    event.stopPropagation();
    this.favoriteService.toggleFavorite(this.item.id);
  }
  
onItemClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  
  this.toggleSelect.emit({
    item: this.item, 
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey  // ← NUEVO: Detecta Shift
  });
}

  
  onDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.itemDoubleClick.emit();
  }
}
