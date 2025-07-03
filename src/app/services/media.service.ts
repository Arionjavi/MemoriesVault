import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { MediaItem } from '../models/media-item.model';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private startYear = 2000;
  private endYear = 2035;
  private allMediaItems: MediaItem[] = [];
  private mediaCache: {[year: number]: MediaItem[]} = {};
  
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

getAllMediaItems(): Observable<MediaItem[]> {
  if (this.allMediaItems.length > 0) {
    return of(this.allMediaItems);
  }
  
  const requests: Observable<MediaItem[]>[] = [];
  for (let year = this.startYear; year <= this.endYear; year++) {
    requests.push(this.getMediaByYear(year));
  }
  
  return forkJoin(requests).pipe(
    map(results => {
      const allItems: MediaItem[] = [];
      results.forEach(items => {
        allItems.push(...items);
      });
      
      // ORDENAR POR FECHA DESCENDENTE (MÁS RECIENTE PRIMERO)
      const sortedItems = allItems.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime(); // 2025 → 2024 → 2023
      });
      
      this.allMediaItems = sortedItems;
      console.log(`Total elementos cargados: ${sortedItems.length}`);
      
      // Log para verificar orden
const yearCounts: Record<number, number> = {};
      sortedItems.forEach(item => {
        const year = new Date(item.date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });
      console.log('Elementos por año:', yearCounts);
      
      return sortedItems;
    }),
    catchError(error => {
      console.error('Error cargando todos los medios:', error);
      return of([]);
    })
  );
}


  getMediaByYear(year: number): Observable<MediaItem[]> {
    if (this.mediaCache[year]) {
      return of(this.mediaCache[year]);
    }
    
    return this.http.get<{mediaItems: MediaItem[]}>(`assets/data/media-${year}.json`).pipe(
      map(response => {
        const items = response.mediaItems || [];
        console.log(`Año ${year}: ${items.length} elementos cargados`);
        return items;
      }),
      tap(items => {
        this.mediaCache[year] = items;
      }),
      catchError(error => {
        console.warn(`No se encontró archivo para el año ${year}:`, error);
        return of([]);
      })
    );
  }

    getMediaByAlbum(albumId: string): Observable<MediaItem[]> {
    return this.getAllMediaItems().pipe(
      map(allMedia => allMedia.filter(item => item.album === albumId))
    );
  }

  // Limpiar caché para recargar datos
  clearCache(): void {
    this.allMediaItems = [];
    this.mediaCache = {};
  }
}
