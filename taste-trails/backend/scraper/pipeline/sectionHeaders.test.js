import { describe, it, expect } from 'vitest';
import { extractStructuredData } from './structuredExtract.js';
import { extractDomItems } from './domExtract.js';

describe('section header extraction', () => {
  it('keeps menu section names from structured JSON-LD data', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Menu",
              "hasMenuSection": [
                {
                  "@type": "MenuSection",
                  "name": "Starters",
                  "hasMenuItem": [
                    { "@type": "MenuItem", "name": "Calamari", "offers": { "price": "14.00" } },
                    { "@type": "MenuItem", "name": "Bruschetta", "offers": { "price": "12.00" } }
                  ]
                },
                {
                  "@type": "MenuSection",
                  "name": "Entrees",
                  "hasMenuItem": [
                    { "@type": "MenuItem", "name": "Ribeye", "offers": { "price": "38.00" } },
                    { "@type": "MenuItem", "name": "Salmon", "offers": { "price": "29.00" } }
                  ]
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const items = extractStructuredData(html);
    expect(items.length).toBe(4);
    expect(items.every((item) => item.section_name === 'Starters' || item.section_name === 'Entrees')).toBe(true);
  });

  it('does not use item names as section names for flat structured items', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Menu",
              "hasMenuItem": [
                { "@type": "MenuItem", "name": "Cheeseburger", "offers": { "price": "12.00" } },
                { "@type": "MenuItem", "name": "Fries", "offers": { "price": "6.00" } }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const items = extractStructuredData(html);
    expect(items.length).toBe(2);
    expect(items.map((item) => item.section_name)).toEqual(['Menu', 'Menu']);
  });

  it('infers section headers from line-based fallback text parsing', () => {
    const html = `
      <html>
        <body>
          <div>STARTERS</div>
          <div>Calamari $14.00</div>
          <div>ENTREES</div>
          <div>Ribeye $38.00</div>
          <div>SIDES</div>
          <div>Fries $6.00</div>
        </body>
      </html>
    `;

    const result = extractDomItems(html);
    const sectionByItem = Object.fromEntries(result.items.map((item) => [item.name, item.section_name]));

    expect(sectionByItem['Calamari']).toBe('STARTERS');
    expect(sectionByItem['Ribeye']).toBe('ENTREES');
    expect(sectionByItem['Fries']).toBe('SIDES');
  });

  it('extracts strong-tag menu blocks and does not treat #1 as the price', () => {
    const html = `
      <html>
        <body>
          <h3>TO START</h3>
          <p>
            <strong>AHI TUNA STACK</strong> #1 sushi grade, mango, sriracha mayo 20<br>
            <strong>CAST IRON CORN BREAD</strong> green chiles, jack &amp; cheddar 12
          </p>
          <h3>ENTREES</h3>
          <p>
            <strong>CEDAR PLANK SALMON</strong> center cut, whole grain mustard butter 37
          </p>
        </body>
      </html>
    `;

    const result = extractDomItems(html);
    const itemsByName = Object.fromEntries(result.items.map((item) => [item.name, item]));

    expect(itemsByName['AHI TUNA STACK']).toBeDefined();
    expect(itemsByName['AHI TUNA STACK'].price).toBe(20);
    expect(itemsByName['AHI TUNA STACK'].section_name).toBe('TO START');
    expect(itemsByName['CEDAR PLANK SALMON'].section_name).toBe('ENTREES');
  });
});
