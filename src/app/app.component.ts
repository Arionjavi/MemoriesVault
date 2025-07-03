import { Component, ViewChild, ElementRef, OnInit, AfterViewInit, Renderer2, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { FavoritesComponent } from './components/favorites/favorites.component';
import { AlbumsComponent } from './components/albums/albums.component';
import { ScrollToTopComponent } from './components/scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    GalleryComponent,
    FavoritesComponent,
    AlbumsComponent,
    ScrollToTopComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  activeSection: string = 'fototeca';
  
  // Propiedades para el reproductor de audio
selectedAlbumId: string | undefined;
  isPlaying: boolean = false;
  isMuted: boolean = false;
  volume: number = 0.7;
  currentTime: number = 0;
  duration: number = 0;
  tracks: { title: string, src: string }[] = [
    { title: 'Viva la vida - Coldplay', src: 'assets/audio/cancion1.mp3' },
    { title: 'Mi lamento - Dani Martin', src: 'assets/audio/cancion2.mp3' },
    { title: 'Mi heroe - Antonio Orozco', src: 'assets/audio/cancion3.mp3' }
  ];
  currentTrackIndex: number = 0;
  
  // Propiedades para el tema
  isDarkMode: boolean = false;
  
  get audioPlayer(): HTMLAudioElement {
    return this.audioPlayerRef.nativeElement;
  }
  
  constructor(
    private renderer: Renderer2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  
  ngOnInit() {
    // Solo en el navegador
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('app-theme');
      this.isDarkMode = savedTheme === 'dark';
      this.applyTheme();
    }
  }
  
  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.loadTrack(this.currentTrackIndex);
        this.audioPlayer.volume = this.volume;
        this.updateVolumeSlider();
      }, 100);
    }
  }
onNavigate(section: string): void {
  this.activeSection = section;
  
  // 🎯 RESETEAR ÁLBUM SELECCIONADO cuando se navega a álbumes desde sidebar
  if (section === 'albumes') {
    this.selectedAlbumId = undefined; // ← AÑADIR ESTO
  } else {
    this.selectedAlbumId = undefined;
  }
}

  
  // Funciones para el tema
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('app-theme', this.isDarkMode ? 'dark' : 'light');
    }
    this.applyTheme();
  }
  
  applyTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.isDarkMode) {
        this.renderer.addClass(document.body, 'dark-theme');
      } else {
        this.renderer.removeClass(document.body, 'dark-theme');
      }
    }
  }

    onAlbumSelected(albumId: string): void {
    this.activeSection = 'albumes';
    this.selectedAlbumId = albumId;
  }

   onAlbumSelectedFromGrid(albumId: string): void {
    this.selectedAlbumId = albumId || undefined;
  }
  
  // Funciones para el reproductor de audio
  getCurrentSongName(): string {
    return this.tracks[this.currentTrackIndex]?.title || 'Sin canción';
  }
  
  loadTrack(index: number): void {
    if (index >= 0 && index < this.tracks.length) {
      this.currentTrackIndex = index;
      this.audioPlayer.src = this.tracks[index].src;
    }
  }
  
  togglePlay(): void {
    if (this.isPlaying) {
      this.audioPlayer.pause();
    } else {
      this.audioPlayer.play();
    }
    this.isPlaying = !this.isPlaying;
  }
  
  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.audioPlayer.muted = this.isMuted;
    
    if (this.isMuted) {
      this.updateVolumeSlider(0);
    } else {
      this.updateVolumeSlider(this.volume * 100);
    }
  }
  
updateVolume(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value) / 100;
    this.volume = value;
    this.audioPlayer.volume = value;
    
    // Cambiar automáticamente el icono según el volumen
    if (value === 0) {
      this.isMuted = true;
      this.audioPlayer.muted = true;
    } else {
      this.isMuted = false;
      this.audioPlayer.muted = false;
    }
    
    this.updateVolumeSlider(Number(target.value));
}


  
  updateVolumeSlider(value?: number): void {
    if (isPlatformBrowser(this.platformId)) {
      const volumeSlider = document.querySelector('.volume-control') as HTMLElement;
      if (volumeSlider) {
        const progress = value !== undefined ? value : this.volume * 100;
        volumeSlider.style.setProperty('--volume-progress', `${progress}%`);
      }
    }
  }
  
  updateProgress(): void {
    this.currentTime = this.audioPlayer.currentTime;
    this.duration = this.audioPlayer.duration || 0;
    
    if (isPlatformBrowser(this.platformId)) {
      const progressBar = document.querySelector('.progress-bar') as HTMLElement;
      if (progressBar && this.duration > 0) {
        const progress = (this.currentTime / this.duration) * 100;
        progressBar.style.setProperty('--time-progress', `${progress}%`);
      }
    }
  }
  
  seekTo(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    this.audioPlayer.currentTime = value;
    
    // Actualizar visualmente el progreso inmediatamente
    if (isPlatformBrowser(this.platformId)) {
      const progressBar = document.querySelector('.progress-bar') as HTMLElement;
      if (progressBar && this.duration > 0) {
        const progress = (value / this.duration) * 100;
        progressBar.style.setProperty('--time-progress', `${progress}%`);
      }
    }
  }
  
  previousTrack(): void {
    let index = this.currentTrackIndex - 1;
    if (index < 0) index = this.tracks.length - 1;
    this.loadTrack(index);
    if (this.isPlaying) this.audioPlayer.play();
  }
  
  nextTrack(): void {
    let index = this.currentTrackIndex + 1;
    if (index >= this.tracks.length) index = 0;
    this.loadTrack(index);
    if (this.isPlaying) this.audioPlayer.play();
  }
  
  onTrackEnded(): void {
    this.nextTrack();
  }
  
  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  }
}
