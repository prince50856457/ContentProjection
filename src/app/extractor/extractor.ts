import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-extractor',
  imports: [CommonModule],
  templateUrl: './extractor.html',
  styleUrls: ['./extractor.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExtractorComponent {
  private http = inject(HttpClient);
  url = signal('');
  extractedContent = signal('');
  keyConcepts = signal<string[]>([]);
  relatedLinks = signal<{title: string, url: string}[]>([]);
  loading = signal(false);

  extractContent() {
    if (this.url()) {
      this.loading.set(true);
      this.extractedContent.set('');
      this.keyConcepts.set([]);
      this.relatedLinks.set([]);
      this.http.post<{content: string, keyConcepts: string[], relatedLinks: {title: string, url: string}[]}>('/api/extract', { url: this.url() })
        .subscribe(res => {
          this.extractedContent.set(res.content);
          this.keyConcepts.set(res.keyConcepts);
          this.relatedLinks.set(res.relatedLinks);
          this.loading.set(false);
        });
    }
  }

  onUrlChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.url.set(target.value);
  }
}