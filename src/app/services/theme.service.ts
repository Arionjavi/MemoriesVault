import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  private isDark = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = localStorage.getItem(this.THEME_KEY) === 'dark';
    }
  }

  get isDarkMode(): boolean {
    return this.isDark;
  }

  toggleTheme(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.THEME_KEY, this.isDark ? 'dark' : 'light');
    }
    this.applyTheme();
  }

  private applyTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.toggle('dark-theme', this.isDark);
    }
  }
}
