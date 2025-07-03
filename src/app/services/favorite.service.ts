import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private STORAGE_KEY = 'favorite_media_items';
  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.loadFavorites();
  }

  private loadFavorites(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          this.favoritesSubject.next(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading favorites from localStorage:', error);
        this.favoritesSubject.next([]);
      }
    } else {
      // SSR: No hacer nada, no hay localStorage
      this.favoritesSubject.next([]);
    }
  }

  isFavorite(mediaId: string): boolean {
    return this.favoritesSubject.value.includes(mediaId);
  }

  toggleFavorite(mediaId: string): void {
    const currentFavorites = this.favoritesSubject.value;
    let newFavorites: string[];

    if (currentFavorites.includes(mediaId)) {
      newFavorites = currentFavorites.filter(id => id !== mediaId);
    } else {
      newFavorites = [...currentFavorites, mediaId];
    }

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newFavorites));
    }

    this.favoritesSubject.next(newFavorites);
  }

  getFavoriteIds(): string[] {
    return this.favoritesSubject.value;
  }
}
