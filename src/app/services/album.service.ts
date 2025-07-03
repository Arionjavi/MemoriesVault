import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Album } from '../models/album.model';

@Injectable({
  providedIn: 'root'
})
export class AlbumService {
  constructor(private http: HttpClient) {}
  
  getAlbums(): Observable<Album[]> {
    // Intentar cargar desde el archivo JSON
    return this.http.get<{albums: Album[]}>('assets/data/albums.json').pipe(
      map(response => response.albums),
      catchError(error => {
        console.error('Error loading albums from JSON:', error);
        
        // Si falla, crear una lista basada en la imagen de referencia
        return of([
          { id: 'navidades2024', name: 'NAVIDADES 2024', year: '2024', path: 'assets/Albumes/2024/NAVIDADES 2024' },
          { id: 'canarias2023', name: 'CANARIAS 2023', year: '2023', path: 'assets/Albumes/2023/CANARIAS 2023' },
          { id: 'castillo2022', name: 'CASTILLO 2022', year: '2022', path: 'assets/Albumes/2022/CASTILLO 2022' },
          { id: 'paris2022', name: 'PARÍS 2022', year: '2022', path: 'assets/Albumes/2022/PARIS 2022' },
          { id: 'atienza2023', name: 'ATIENZA 2023', year: '2023', path: 'assets/Albumes/2023/ATIENZA 2023' },
          { id: 'cruceroMed2023', name: 'CRUCERO MEDITERRANEO 2023', year: '2023', path: 'assets/Albumes/2023/CRUCERO MEDITERRANEO 2023' },
          { id: 'newyork2023', name: 'NEW YORK 2023', year: '2023', path: 'assets/Albumes/2023/NEW YORK 2023' },
          { id: 'berlin2024', name: 'BERLÍN 2024', year: '2024', path: 'assets/Albumes/2024/BERLIN 2024' }
        ]);
      })
    );
  }
  
  getAlbumById(id: string): Observable<Album | undefined> {
    return this.getAlbums().pipe(
      map(albums => albums.find(album => album.id === id))
    );
  }
}
