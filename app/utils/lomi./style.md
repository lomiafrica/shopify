# Documentation Writing Style Guide

This document outlines the writing style conventions used in the lomi. documentation. Consistency in style helps create a clear and professional experience for readers.

OUR COMPANY NAME IS WRITTEN : "lomi." with a dot '.' at the end and in low caps.

OUR API IS WRITTEN : "LOMI_API_KEY".

## **Headings**

-   **Level 1 (H1):** Use `# **Title**`. Always bold and use sentence case (capitalize only the first word and proper nouns). Example: `# **What is lomi.?**`
-   **Level 2 (H2):** Use `## **Title**`. Always bold and use sentence case. Example: `## **Payment complexity**`
-   **Level 3 (H3):** Use `### **Title**`. Always bold and use sentence case. Example: `### **Share your experience**`
-   **Level 4 (H4) and below:** Use standard markdown (`#### Title`, etc.) with sentence case. Bold is optional but generally used for emphasis within the text rather than for lower-level headings.

## **Emphasis**

-   Use **bold (`**text**`)** for:
    -   Highlighting key terms or concepts on first use.
    -   Drawing attention to important phrases or actions (e.g., "**Build, test & deploy**").
    -   Headings (as described above).
-   Use *italics (`*text*` or `_text_`)** sparingly, primarily for subtle emphasis or titles of works if needed (though generally not used in the current docs).
-   Use ***bold italics (`***text***`)*** very sparingly for extreme emphasis.

## **Lists**

-   Use hyphens (`-`) for unordered lists.
-   Use numbers (`1.`, `2.`) for ordered lists, especially for steps.
-   Maintain consistent sentence structure within list items where possible.

## **Code and Technical Terms**

-   Use backticks (`` `code` ``) for inline code, filenames (`what-is-lomi.mdx`), component names (`InfoBox`), API names, commands, and technical terms.
-   Use triple backticks (```) with a language identifier (e.g., ```tsx`) for code blocks.
-   **Code Block Titles:** To add a title or filename to a code block, append `filename="Your Title"` after the language identifier. This is useful for context, especially for terminal commands or file examples. Use sentence case for these titles (e.g., `filename="Terminal output example"` not `filename="Terminal Output Example"`).
    -   For blocks representing terminal command input (typically `bash`), use `filename="Terminal"` unless a more specific title is needed for clarity.
    -   For blocks representing file contents (e.g., `.ts`, `.json`, `.env`) or specific named outputs, use a descriptive sentence-case title (e.g., `filename="Node.js SDK initialization"`, `filename="Example response from GET /providers"`).
    -   Example for terminal commands:
        ```markdown
        ```bash filename="Terminal"
        lomi. login
        ```
        ```
    -   Example for text output:
        ```markdown
        ```text filename="Terminal output example"
        Login successful!
        ```
        ```

## **Tone and Voice**

-   **Professional yet approachable:** Aim for clarity and accuracy.
-   **Merchant-focused:** Speak directly to the user (merchants, developers). Use "you" and "your".
-   **Action-oriented:** Use strong verbs, especially in headings related to actions (e.g., "Build with us").
-   **Concise:** Avoid jargon where possible and explain technical terms clearly.

## **Specific Components and Formatting**

-   **`InfoBox` Component:**
    -   Use the `<InfoBox>` component (imported from `src/components/ui/info-box.tsx`) for highlighting important notes, tips, or warnings.
    -   Syntax:
        ```mdx
        import InfoBox from '@/components/ui/info-box';

        <InfoBox title="Optional Title" variant="blue|green|red|yellow" type="info|tip">
          Your content here. Links can be included normally.
        </InfoBox>
        ```
    -   The `title` defaults to "Important".
    -   `variant` controls the color scheme.
    -   `type="tip"` uses a different icon (Rabbit instead of Info).
    -   See `src/pages/docs/introduction/what-is-lomi.mdx` for an example of blockquote usage (`> ***Get started...***`), which can sometimes serve a similar purpose to `InfoBox` for callouts. Decide based on visual preference and content.

-   **Nextra `Callout` Component:**
    -   Use the `<Callout>` component (imported from `nextra/components`) for highlighting information with different levels of emphasis (info, warning, error). It's visually distinct from `InfoBox`.
    -   Import: `import { Callout } from 'nextra/components';`
    -   Syntax:
        ```mdx
        <Callout type="info|warning|error|default" emoji="💡" title="Optional Title">
          Your content here. Markdown works.
        </Callout>
        ```
    -   The `type` prop controls the styling (defaults to `default`). Common types are `info`, `warning`, and `error`.
    -   An `emoji` prop can be used for a leading icon.

-   **Nextra `Steps` Component:**
    -   Use the `<Steps>` component (imported from `nextra/components`) to render ordered lists (like tutorials or installation guides) with enhanced visual styling.
    -   Import: `import { Steps } from 'nextra/components';`
    -   Syntax:
        ```mdx
        <Steps>
          ### **Step 1 Title**
          Content for step 1.

          ### **Step 2 Title**
          Content for step 2.
        </Steps>
        ```
    -   Use Markdown headings (`###`) inside `<Steps>` to denote individual steps.

-   **Nextra `Tabs` Component:**
    -   Use the `<Tabs>` and `<Tab>` components (imported from `nextra/components`) to group related content under selectable tabs, useful for showing variations (e.g., code for different package managers).
    -   Import: `import { Tabs, Tab } from 'nextra/components';`
    -   Syntax:
        ```mdx
        <Tabs items={['npm', 'yarn', 'pnpm']}>
          <Tab>
            ```bash
            npm install lomi.
            ```
          </Tab>
          <Tab>
            ```bash
            yarn add lomi.
            ```
          </Tab>
          <Tab>
            ```bash
            pnpm add lomi.
            ```
          </Tab>
        </Tabs>
        ```
    -   The `items` prop on `<Tabs>` defines the titles for each tab. The content for each tab goes inside a corresponding `<Tab>` element in order.

-   **Nextra `Cards` and `Card` Components:**
    -   Use `<Cards>` and `<Card>` (imported from `nextra/components`) to create a grid layout, ideal for landing pages or section overviews linking to other pages.
    -   Import: `import { Cards, Card } from 'nextra/components';`
    -   Syntax (example using lucide-react icons):
        ```mdx
        import { Cards, Card } from 'nextra/components';
        import { Terminal, BookOpen } from 'lucide-react'; // Example icon import

        <Cards>
          <Card
            icon={<Terminal />}
            title="CLI Reference"
            href="/docs/lomi-cli/overview"
          >
            Learn how to use the lomi. CLI.
          </Card>
          <Card
            icon={<BookOpen />}
            title="API Reference"
            href="/docs/api-reference"
          >
            Explore the Lomi API.
          </Card>
          {/* Add more Card components as needed */}
        </Cards>
        ```
    -   Place `<Card>` components inside `<Cards>`. Each `<Card>` can take an `icon`, `title`, `href` (for the link), and children (for the description).

-   **Links:** Use standard markdown links `[Link text](URL)`. Ensure link text is descriptive. For internal links, use relative paths (e.g., `/docs/freedom/codebase`).

## **General Conventions**

-   **Abbreviations:** Define abbreviations on first use if they are not common knowledge (e.g., "Banque Centrale des États de l'Afrique de l'Ouest (BCEAO)").
-   **Contractions:** Use contractions (like "don't", "it's", "you're") where appropriate to maintain a conversational tone, but avoid overuse.
-   **Grammar and Spelling:** Proofread carefully. Use consistent spelling (e.g., US English).

By adhering to these guidelines, we can maintain a consistent, readable, and professional documentation site. 