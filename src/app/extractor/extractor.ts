import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

// Define the new, richer data structures
export interface Concept {
  overview: string;
  explanation: string;
  example: string;
  mistakes: string;
}

export interface Link {
  title: string;
  url: string;
}

export type ContentBlock = 
  | { type: 'heading'; level: number; text: string; }
  | { type: 'paragraph'; text: string; }
  | { type: 'bullets'; items: string[]; }
  | { type: 'code'; text: string; }; // Added code block type

export type FormattedContent = ContentBlock[];

export interface ExtractionResult {
  content: string; // Expect plain text
  keyConcepts: Concept[];
  relatedLinks: Link[];
}

@Component({
  selector: 'app-extractor',
  templateUrl: './extractor.html',
  styleUrls: ['./extractor.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtractorComponent {
  private http = inject(HttpClient);

  // App State Signals
  url = signal('https://angular.dev/blog/angular-v17-is-now-available');
  isLoading = signal(false);
  error = signal('');
  activeConceptIndex = signal<number | null>(null);

  // Content Signals
  extractedContent = signal<FormattedContent | null>(null);
  keyConcepts = signal<Concept[]>([]);
  relatedLinks = signal<Link[]>([]);

  // Pagination Signals
  currentPage = signal(1);
  itemsPerPage = signal(10);
  totalPages = computed(() => {
    const totalItems = this.extractedContent()?.length ?? 0;
    return Math.ceil(totalItems / this.itemsPerPage());
  });

  paginatedContent = computed(() => {
    const content = this.extractedContent();
    if (!content) return null;

    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return content.slice(startIndex, endIndex);
  });

  // Handle input changes to update the url signal
  onUrlChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.url.set(inputElement.value);
  }

  toggleConcept(index: number): void {
    this.activeConceptIndex.update(current => current === index ? null : index);
  }

  extractContent(): void {
    if (!this.url()) return;
    this.isLoading.set(true);
    this.error.set('');
    this.extractedContent.set(null);
    this.keyConcepts.set([]);
    this.relatedLinks.set([]);
    this.currentPage.set(1); // Reset to first page

    this.http.post<ExtractionResult>('/api/extract', { url: this.url() })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          // Format the content before setting the signal
          this.extractedContent.set(this.formatContent(res.content));
          this.keyConcepts.set(res.keyConcepts);
          this.relatedLinks.set(res.relatedLinks);
        },
        error: (err) => {
          this.error.set(err.error?.error || 'An unknown error occurred.');
        }
      });
  }

  // --- PAGINATION CONTROLS ---
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(page => page + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  private formatContent(text: string): FormattedContent {
    if (!text) return [];

    const blocks: FormattedContent = [];
    const lines = text.split('\n');

    let currentList: string[] | null = null;
    let inCodeBlock = false;
    let currentCode = '';

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                if (currentList) {
                    blocks.push({ type: 'bullets', items: currentList });
                    currentList = null;
                }
                blocks.push({ type: 'code', text: currentCode.trim() });
                currentCode = '';
                inCodeBlock = false;
            } else {
                // Start of code block
                if (currentList) {
                    blocks.push({ type: 'bullets', items: currentList });
                    currentList = null;
                }
                inCodeBlock = true;
            }
            continue; // Move to the next line
        }

        if (inCodeBlock) {
            currentCode += line + '\n';
            continue;
        }
        
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('#')) {
            if (currentList) {
                blocks.push({ type: 'bullets', items: currentList });
                currentList = null;
            }
            const level = trimmedLine.startsWith('###') ? 3 : trimmedLine.startsWith('##') ? 2 : 1;
            const text = trimmedLine.replace(/#/g, '').trim();
            blocks.push({ type: 'heading', level, text });
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            if (!currentList) {
                currentList = [];
            }
            currentList.push(trimmedLine.substring(2));
        } else if (trimmedLine) {
            if (currentList) {
                blocks.push({ type: 'bullets', items: currentList });
                currentList = null;
            }
            blocks.push({ type: 'paragraph', text: trimmedLine });
        } else {
            if (currentList) {
                blocks.push({ type: 'bullets', items: currentList });
                currentList = null;
            }
        }
    }

    if (currentList) {
        blocks.push({ type: 'bullets', items: currentList });
    }

    return blocks;
  }
}
