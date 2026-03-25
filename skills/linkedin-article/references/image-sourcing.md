# Image Sourcing for LinkedIn Articles

## Priority Order for Finding Images

1. **Official source images** — If referencing a framework, book, or study, check if the source publishes diagrams or charts. These are the most credible and relevant.
2. **Creative Commons (CC BY 4.0 or CC0)** — Free to use with attribution. Search Wikimedia Commons, Unsplash, or the source organization's site.
3. **Screenshots from free/public resources** — Books published freely online (like Shape Up), public reports, open documentation. Credit the source.
4. **Author-created sketches** — Ask the user if they want to create their own visuals (hand-drawn, iPad, Figma).
5. **AI-generated diagrams** — Mermaid diagrams rendered to SVG/PNG as a last resort.

## Image Requirements

- **Format:** PNG or JPG. LinkedIn articles support inline images.
- **Resolution:** Minimum 1200px wide for article header. 800px+ for inline images.
- **Attribution:** Always include a caption with source and license below the image.
- **Alt text:** Include descriptive alt text in the markdown image tag.

## Downloading and Embedding

1. Download images to `output/linkedin/images/` (or `output/images/` if flat).
2. Verify the file is a valid image using `file` command.
3. Embed in markdown with relative path: `![Alt text](images/filename.png)`
4. Add attribution line in italics below: `*Source: Name, License*`

## Gated Content

If the best chart or infographic is behind a login/download wall (e.g., Pendo reports, Gartner), note this in the article as a blockquote with:
- The download URL
- Instructions to screenshot the relevant chart
- The attribution line to use

## Attribution Formats

- **Creative Commons:** `*Source: [Name], [Organization], CC BY 4.0*`
- **Public book/resource:** `*From [Title] by [Author], [Publisher]*`
- **Screenshot of public data:** `*Source: [Organization] [Report Name] ([Year])*`
- **Author's own visual:** No attribution needed
