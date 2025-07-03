import { Component, OnInit, Input, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true, // ← AÑADIR ESTO
  imports: [CommonModule], // ← AÑADIR ESTO
  templateUrl: './scroll-to-top.component.html',
  styleUrls: ['./scroll-to-top.component.scss']
})
export class ScrollToTopComponent implements AfterViewInit {
  @Input() scrollContainerSelector: string = '.albums-container'; // ← YA LO TIENES
  showButton = false;
  private scrollContainer: HTMLElement | null = null;

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector(this.scrollContainerSelector);
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.onScroll.bind(this));
    }
  }

  onScroll(): void {
    if (this.scrollContainer) {
      this.showButton = this.scrollContainer.scrollTop > 300;
    }
  }

  scrollToTop(): void {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }
}
