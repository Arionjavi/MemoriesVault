import { SidebarComponent } from './components/sidebar/sidebar.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { MediaItemComponent } from './components/media-item/media-item.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AppComponent } from './app.component';
import { NgModule } from '@angular/core';

@NgModule({
  declarations: [
    AppComponent,
    SidebarComponent,
    GalleryComponent,
    MediaItemComponent,
     MatProgressSpinnerModule,
    MatProgressBarModule
  ],
})
export class AppModule { }
