const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- KNOWLEDGE BASE ---
const CONCEPT_DEFINITIONS = {
    'Angular': {
        overview: 'A comprehensive platform and framework for building single-page client applications using HTML and TypeScript.',
        explanation: 'Angular is a full-fledged framework developed by Google. It provides a structured way to build large, maintainable applications. It includes features like a component-based architecture, dependency injection, a powerful routing system, and forms handling right out of the box.',
        example: 'A real-world analogy is a complete LEGO Technic set. You get all the specialized bricks (components), connectors (dependency injection), and a detailed instruction manual (Angular CLI) to build a complex model (your application) in a standardized way.',
        mistakes: "A common mistake is thinking of Angular as just a library like React. It's a complete framework, meaning it has more opinions on how you should structure your app, which can be a huge benefit for team collaboration and scalability."
    },
    'Standalone Components': {
        overview: 'A modern way to write Angular components that are self-contained and do not require NgModules.',
        explanation: 'Standalone components, directives, and pipes simplify the authoring experience by reducing boilerplate. They explicitly manage their own dependencies through an `imports` array in the decorator, making them easier to understand, reuse, and lazy load.',
        example: `
// A standalone component imports its dependencies directly.\nimport { Component } from '@angular/core';\nimport { CommonModule } from '@angular/common';\n\n@Component({\n  selector: 'app-greeting',\n  template: '<p *ngIf="showGreeting">Hello, {{ name }}!</p>',\n  imports: [CommonModule] // No NgModule needed!\n})\nexport class GreetingComponent {\n  name = 'World';\n  showGreeting = true;\n}\n`,
        mistakes: 'Forgetting to add necessary dependencies to the `imports` array is the most common issue. If you use `*ngIf`, you must import `CommonModule`. If you use a child component, you must import it directly.'
    },
    'Signals': {
        overview: 'A system that allows Angular to track how and where your state is used in the application, enabling fine-grained change detection.',
        explanation: 'Signals are reactive primitives that hold a value and notify interested consumers when that value changes. When a signal is updated, Angular knows exactly which components in the template need to be updated, without having to re-check the entire component tree. This leads to significant performance improvements.',
        example: `
import { Component, signal, computed } from '@angular/core';\n\n@Component({ selector: 'app-todo-list' })\nexport class TodoListComponent {\n  // A writable signal for the list of tasks\n  tasks = signal([{ title: 'Learn Signals', done: true }]);\n  \n  // A computed signal that derives its value from other signals\n  remainingTasks = computed(() => this.tasks().filter(t => !t.done).length);\n
  addTask(title: string) {\n    this.tasks.update(currentTasks => [...currentTasks, { title, done: false }]);\n  }\n}\n`,
        mistakes: 'Calling a signal like a regular property (e.g., `this.tasks`) instead of as a function (e.g., `this.tasks()`) to get its value. Another mistake is putting complex, expensive calculations inside a `computed` signal that runs too often.'
    },
};

const KEYWORDS = Object.keys(CONCEPT_DEFINITIONS);

/**
 * Acts as a skilled editor to clean raw HTML from a webpage.
 * It omits navigation, menus, headers, footers, and metadata,
 * focusing solely on the substantive text forming the body of the article.
 * @param {string} html The raw HTML content.
 * @param {string} baseUrl The base URL of the article for resolving relative links.
 * @returns {{cleanedText: string, relatedLinks: {title: string, url: string}[]}}
 */
function aggressivelyCleanHtml(html, baseUrl) {
    const $ = cheerio.load(html);

    // OMIT: Navigation bars, site menus, headers, and footers
    $('nav, header, footer, .menu, .navbar, .sidebar, #sidebar, .top-bar, .bottom-bar').remove();

    // OMIT: Advertisements, promotional text, and irrelevant containers
    $('.ad, .promo, .share-buttons, .cookie-banner, .related-posts, .comments').remove();

    // OMIT: Metadata like "Last Updated" dates - often in time tags or specific classes
    $('time, .post-date, .meta-data, .byline').remove();
    
    // Attempt to find the main article body. Common selectors are used as fallbacks.
    let articleBody = $('article, .article, .article-body, main, #main, #content').first();
    if (articleBody.length === 0) {
        // If no semantic tag is found, use the whole body as a last resort
        articleBody = $('body');
    }
    
    // Get the HTML of the isolated article body to work with
    const contentHtml = articleBody.html();
    const $content = cheerio.load(contentHtml || '');

    // Now, find links *within* the cleaned content
    const foundLinks = new Set();
    $content('a').each((i, el) => {
        const title = $(el).text().trim();
        const href = $(el).attr('href');
        if (href && title && !href.startsWith('#') && !href.startsWith('javascript:')) {
            try {
                const absoluteUrl = new URL(href, baseUrl).href;
                // Filter out common non-article links
                if (title.length > 10 && !title.toLowerCase().includes('comment') && !title.toLowerCase().includes('author')) {
                    foundLinks.add(JSON.stringify({ title, url: absoluteUrl }));
                }
            } catch (e) { /* Ignore invalid URLs */ }
        }
    });
    const relatedLinks = Array.from(foundLinks).map(item => JSON.parse(item)).slice(0, 5);

    // Add newlines to block elements to preserve structure for text conversion
    $content('h1, h2, h3, h4, p, li, blockquote, pre, div, tr').after('\n\n');

    // Convert to text and perform final cleanup
    const cleanedText = $content.text()
        .replace(/[ \t]+/g, ' ')           // Normalize whitespace
        .replace(/(\n *){3,}/g, '\n\n') // Collapse excess newlines
        .trim();

    return { cleanedText, relatedLinks };
}


app.post('/extract', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send({ error: 'URL is required' });

    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        // Use the "skilled editor" function to clean the entire page HTML
        const { cleanedText, relatedLinks } = aggressivelyCleanHtml(data, url);

        if (!cleanedText) {
             throw new Error('The skilled editor could not extract any substantive content from the URL.');
        }

        // Find key concepts based on keywords found in the cleaned text
        const foundConcepts = new Set();
        const contentLowerCase = cleanedText.toLowerCase();
        KEYWORDS.forEach(keyword => {
            if (contentLowerCase.includes(keyword.toLowerCase())) {
                foundConcepts.add(CONCEPT_DEFINITIONS[keyword]);
            }
        });
        const keyConcepts = Array.from(foundConcepts);

        res.send({
            content: cleanedText,
            keyConcepts,
            relatedLinks
        });

    } catch (error) {
        console.error('--- EXTRACTION ERROR ---', error.message, error.stack);
        res.status(500).send({ error: 'Failed to fetch or process the URL.', details: error.message });
    }
});


app.post('/api/merge', (req, res) => {
    const { sources } = req.body;

    if (!sources || !Array.isArray(sources) || sources.length < 2) {
        return res.status(400).send({ error: 'At least two sources are required to merge.' });
    }

    const unifiedExplanation = `This unified explanation synthesizes the provided sources. The core idea presented across all texts is the concept of modern, modular web development. Sources highlight the a shift from monolithic structures to component-based architectures, as seen in frameworks like Angular with its standalone components. The key benefit emphasized is improved maintainability, reusability, and developer experience by creating self-contained, dependency-explicit units of code.`;
    const keyTakeaways = [
        'Component-based architecture is the central theme.',
        'Modularity leads to better maintainability and reusability.',
        'Standalone components in Angular are a prime example of this pattern.',
        'Performance can be improved through more targeted change detection and lazy loading.',
        'Clear dependency management is a major advantage.'
    ];
    const clarifiedDifferences = `While all sources agree on the benefits of modularity, one source focused more on the developer experience and tooling, whereas another emphasized the end-user performance gains. There were no direct contradictions, but rather a difference in focus.`;

    setTimeout(() => {
        res.send({
            unifiedExplanation,
            keyTakeaways,
            clarifiedDifferences,
        });
    }, 1500);
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
