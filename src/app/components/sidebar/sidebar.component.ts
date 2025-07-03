import { Component, Output, EventEmitter, OnInit, Input, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AlbumService } from '../../services/album.service';
import { Album } from '../../models/album.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  @Input() activeSection: string = 'fototeca';
  @Input() selectedAlbumId?: string;
  @Output() navigationChange = new EventEmitter<string>();
  @Output() albumSelected = new EventEmitter<string>();

  albums: Album[] = [];
  sortedAlbums: Album[] = [];
  isAscendingSort: boolean = false; // false = descendente (2024->2021), true = ascendente (2021->2024)
  isDarkMode = false;
  
  sections = [
    { id: 'fototeca', name: 'Fototeca', icon: 'photo_library' },
    { id: 'favoritos', name: 'Favoritos', icon: 'favorite' },
    { id: 'albumes', name: 'Álbumes', icon: 'collections_bookmark' }
  ];

  constructor(
    private albumService: AlbumService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.checkDarkMode();
      const observer = new MutationObserver(() => this.checkDarkMode());
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.loadAlbums();
    this.loadSortPreference();
  }

  checkDarkMode() {
  this.isDarkMode = document.body.classList.contains('dark-theme');
}

  loadAlbums(): void {
    this.albumService.getAlbums().subscribe({
      next: (albums) => {
        this.albums = albums;
        this.sortAlbums();
      },
      error: (error) => {
        console.error('Error cargando álbumes:', error);
      }
    });
  }

  toggleAlbumSort(): void {
    this.isAscendingSort = !this.isAscendingSort;
    this.sortAlbums();
    this.saveSortPreference();
  }

  sortAlbums(): void {
    this.sortedAlbums = [...this.albums].sort((a, b) => {
      const yearA = parseInt(a.year);
      const yearB = parseInt(b.year);
      
      if (this.isAscendingSort) {
        return yearA - yearB; // 2021, 2022, 2023, 2024...
      } else {
        return yearB - yearA; // 2024, 2023, 2022, 2021...
      }
    });
  }

  getSortIcon(): string {
    return this.isAscendingSort ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  getSortTooltip(): string {
    return this.isAscendingSort ? 'Ordenar de mayor a menor año' : 'Ordenar de menor a mayor año';
  }

  private loadSortPreference(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedSort = localStorage.getItem('albums-sort-ascending');
      if (savedSort !== null) {
        this.isAscendingSort = savedSort === 'true';
        this.sortAlbums();
      }
    }
  }

  private saveSortPreference(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('albums-sort-ascending', this.isAscendingSort.toString());
    }
  }

  navigate(sectionId: string): void {
    this.activeSection = sectionId;
    this.navigationChange.emit(sectionId);
  }

  selectAlbum(albumId: string): void {
    this.albumSelected.emit(albumId);
  }
}
