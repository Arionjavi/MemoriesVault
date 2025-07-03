import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface Track {
  title: string;
  src: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private currentTrackSubject = new BehaviorSubject<Track | null>(null);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  private volumeSubject = new BehaviorSubject<number>(0.7);
  
  currentTrack$ = this.currentTrackSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();
  volume$ = this.volumeSubject.asObservable();
  
  constructor() {}
  
  init(): void {
    // Recuperar estado del localStorage si existe
    const savedVolume = localStorage.getItem('audio-volume');
    if (savedVolume) {
      this.volumeSubject.next(Number(savedVolume));
    }
  }
  
  loadTrack(track: Track): void {
    this.currentTrackSubject.next(track);
  }
  
  togglePlay(): void {
    const isCurrentlyPlaying = this.isPlayingSubject.value;
    this.isPlayingSubject.next(!isCurrentlyPlaying);
  }
  
  setVolume(volume: number): void {
    this.volumeSubject.next(volume);
    localStorage.setItem('audio-volume', volume.toString());
  }
}
