const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

const KEYWORDS = [
  // Frameworks & Libraries
  'Angular', 'React', 'Vue', 'Svelte', 'jQuery', 'Next.js', 'Node.js', 'Express.js', 'NestJS',
  // Core Concepts
  'Component', 'Standalone Components', 'Signals', 'State Management', 'Change Detection', 'Routing', 'Directive',
  'Dependency Injection', 'Lazy Loading', 'SSR', 'Server-Side Rendering', 'Content Projection', 'Forms', 'Reactive Forms',
  // Language & Syntax
  'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SCSS', 'JSON', 'Decorator', 'Arrow Function', 'Promise', 'Async/Await', 'Observable',
  // Tools & Build Chain
  'Webpack', 'Vite', 'Babel', 'ESLint', 'Prettier', 'CLI', 'Angular CLI', 'npm', 'yarn',
  // General Concepts
  'API', 'REST', 'GraphQL', 'Microservices', 'Monorepo', 'Performance', 'Accessibility', 'PWA', 'Progressive Web App',
];

app.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).send({ error: 'URL is required' });
  }

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);

    // 1. Extract Related Links before modifying the DOM
    const foundLinks = new Set();
    $('a').each((i, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href');
      if (href && title && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const absoluteUrl = new URL(href, url).href;
          // Simple filter to avoid utility links
          if (title.length > 10 && !title.toLowerCase().includes('log in') && !title.toLowerCase().includes('sign up')) {
             foundLinks.add(JSON.stringify({ title, url: absoluteUrl }));
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });
    const relatedLinks = Array.from(foundLinks).map(item => JSON.parse(item)).slice(0, 10); // Limit to 10

    // 2. Clean the DOM and extract text content for keyword analysis
    $('script, style, nav, footer, header, aside, .sidebar, .related-posts, .comments, .cookie-banner').remove();
    const cleanedContent = $('body').text().replace(/\s\s+/g, ' ').trim();

    // 3. Extract Key Concepts
    const foundConcepts = new Set();
    const contentLowerCase = cleanedContent.toLowerCase();
    KEYWORDS.forEach(keyword => {
      if (contentLowerCase.includes(keyword.toLowerCase())) {
        foundConcepts.add(keyword);
      }
    });
    const keyConcepts = Array.from(foundConcepts);

    res.send({ 
      content: cleanedContent.substring(0, 5000), // Limit content length
      keyConcepts,
      relatedLinks
    });

  } catch (error) {
    console.error('--- AXIOS/EXTRACTION ERROR ---');
    console.error('Failed to process URL:', url);
    if (error.response) {
      console.error('Status:', error.response.status);
    } else {
      console.error('Error message:', error.message);
    }
    res.status(500).send({ error: 'Failed to fetch or process the URL. The site may be blocking scrapers or is temporarily down.' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});