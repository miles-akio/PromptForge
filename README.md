# PromptForge ⚡

**A real-time prompt engineering workbench powered by the Claude API**

PromptForge is a fully operational, browser-based tool designed for developers, AI engineers, and anyone working with large language models. It provides a structured environment to craft, test, iterate, and compare prompts against the Claude API — turning prompt engineering from guesswork into a repeatable, measurable discipline.

---

## Table of Contents

1. [Why PromptForge?](#why-promptforge)
2. [Features](#features)
3. [Architecture Overview](#architecture-overview)
4. [How It Works](#how-it-works)
5. [Getting Started](#getting-started)
6. [Usage Guide](#usage-guide)
7. [Prompt Engineering Techniques](#prompt-engineering-techniques)
8. [Project Structure](#project-structure)
9. [Technical Breakdown](#technical-breakdown)
10. [Customization](#customization)
11. [Contributing](#contributing)
12. [License](#license)

---

## Why PromptForge?

Prompt engineering is the critical skill behind effective AI applications. But most developers iterate on prompts by copying text into chat windows, losing track of what worked, what didn't, and why. PromptForge solves this by providing:

- **A structured editor** that separates system prompts, user prompts, and template variables
- **Side-by-side A/B testing** so you can compare two prompt variants against the same input
- **Performance metrics** including response time, estimated token usage, and output length
- **A built-in technique library** with one-click prompt engineering patterns (Chain-of-Thought, Few-Shot, Role Assignment, and more)
- **Session history** so you can track every iteration and revisit past results
- **Export functionality** to save your best prompts as reusable JSON configurations

---

## Features

### Core Capabilities

| Feature | Description |
|---|---|
| **Dual-Pane Editor** | Separate system prompt and user prompt editors with syntax-aware formatting |
| **Template Variables** | Define `{{variables}}` in your prompts and fill them dynamically via a generated form |
| **A/B Comparison Mode** | Run two prompt variants simultaneously and compare outputs side-by-side |
| **Live API Integration** | Connects directly to the Claude API (claude-sonnet-4-20250514) for real responses |
| **Technique Library** | 6 built-in prompt engineering patterns you can inject with one click |
| **Response Metrics** | Tracks response time (ms), estimated input/output tokens, and character count |
| **Session History** | Logs every prompt run with timestamps for full iteration tracking |
| **JSON Export** | Export any prompt configuration as a portable JSON file |
| **Temperature Control** | Adjustable temperature slider (0.0–1.0) for controlling output creativity |
| **Max Tokens Control** | Set the maximum response length from 100 to 4096 tokens |

### Prompt Engineering Techniques

PromptForge includes a built-in library of proven techniques that inject structured patterns into your system prompt:

1. **Chain-of-Thought (CoT)** — Forces the model to reason step-by-step before answering, improving accuracy on logic, math, and multi-step problems.

2. **Few-Shot Examples** — Provides input/output examples that teach the model the expected format and behavior through demonstration.

3. **Role Assignment** — Assigns a specific expert persona to the model, grounding its responses in domain-specific knowledge and tone.

4. **Output Structuring** — Instructs the model to return responses in a specific format (JSON, XML, Markdown tables, etc.) for programmatic consumption.

5. **Self-Critique** — Asks the model to generate an answer, then critically evaluate and improve it — a simple but effective self-refinement loop.

6. **Constraint Setting** — Defines explicit boundaries (word limits, forbidden topics, required inclusions) that shape the model's output.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PromptForge UI                        │
│                   (React / JSX)                         │
├──────────┬──────────┬───────────┬───────────────────────┤
│  Prompt  │ Variable │ Technique │   Response Viewer     │
│  Editor  │   Form   │  Library  │   + Metrics Panel     │
├──────────┴──────────┴───────────┴───────────────────────┤
│                  State Management                       │
│              (React useState/useReducer)                │
├─────────────────────────────────────────────────────────┤
│              Claude API Integration Layer               │
│         (fetch → api.anthropic.com/v1/messages)         │
└─────────────────────────────────────────────────────────┘
```

The application is a **single-file React component** with zero backend dependencies. It communicates directly with the Anthropic API from the browser. All state (prompts, history, settings) lives in React's in-memory state.

---

## How It Works

### 1. Prompt Composition

You write prompts across two fields:

- **System Prompt**: Sets the AI's behavior, persona, and constraints. This is where most prompt engineering techniques are applied.
- **User Prompt**: The actual query or task you're sending to the model.

Both fields support `{{variable}}` syntax. When variables are detected, PromptForge automatically generates input fields so you can fill them in without editing the prompt template itself.

### 2. Variable Interpolation

When you write a prompt like:

```
Translate the following {{source_language}} text into {{target_language}}:
{{text}}
```

PromptForge parses out `source_language`, `target_language`, and `text`, generates form inputs for each, and interpolates the values at runtime before sending to the API.

### 3. API Communication

Prompts are sent to Claude via the Anthropic Messages API:

```javascript
POST https://api.anthropic.com/v1/messages
{
  model: "claude-sonnet-4-20250514",
  max_tokens: <user_setting>,
  system: "<interpolated_system_prompt>",
  messages: [{ role: "user", content: "<interpolated_user_prompt>" }]
}
```

The response is parsed, displayed, and metrics (time, tokens, length) are calculated and shown.

### 4. A/B Testing

In A/B mode, two independent prompt editors appear side by side. Both are sent to the API simultaneously (using `Promise.all`), and results are displayed in parallel columns so you can directly compare:

- Which prompt produced a better response
- Which was faster
- Which used fewer tokens
- How output structure differs

### 5. History Tracking

Every run is logged with:
- Timestamp
- The system and user prompts used
- The model's response (truncated for display)
- Response time and token estimates

You can click any history entry to reload that exact prompt configuration.

---

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

### Running the Application

PromptForge is built as a single React JSX file designed to run inside the Claude.ai artifact environment. To use it:

1. **Open `promptforge.jsx`** in an environment that supports React artifacts (e.g., Claude.ai's artifact renderer).
2. **Enter your API key** in the settings panel (gear icon) — or, if running inside Claude.ai, the API key is handled automatically.
3. **Start engineering prompts.**

### Running Locally (Outside Claude.ai)

To run PromptForge in your own React environment:

1. Copy `promptforge.jsx` into your React project's component directory.
2. Install dependencies (React 18+, Tailwind CSS).
3. Import and render the component:

```jsx
import PromptForge from './promptforge';

function App() {
  return <PromptForge />;
}
```

4. Ensure your Anthropic API key is available (you'll need a proxy or backend to avoid exposing it client-side in production).

---

## Usage Guide

### Basic Workflow

1. **Write a system prompt** — Define the AI's role, constraints, and output format.
2. **Write a user prompt** — Provide the specific task or question.
3. **Fill in variables** — If your prompts contain `{{variables}}`, fill them in the generated form.
4. **Click "Run Prompt"** — The prompt is sent to Claude and the response appears in the output panel.
5. **Review metrics** — Check response time, token usage, and output length.
6. **Iterate** — Modify your prompt and run again. Check history to compare iterations.

### A/B Testing Workflow

1. **Toggle "A/B Mode"** in the top toolbar.
2. **Write Variant A** in the left editor and **Variant B** in the right editor.
3. **Click "Run A/B Test"** — Both variants are sent simultaneously.
4. **Compare results** — Outputs appear side by side with independent metrics.

### Using Techniques

1. Click the **beaker icon** (Techniques) in the toolbar.
2. Browse available techniques — each has a description and preview.
3. Click **"Apply"** on any technique to inject it into your system prompt.
4. Modify the injected text to fit your specific use case.

### Exporting Prompts

1. After crafting a prompt you're happy with, click the **export icon**.
2. A JSON file downloads containing your system prompt, user prompt, variables, and settings.
3. Use this JSON to reproduce the exact same prompt configuration later or integrate it into your application code.

---

## Prompt Engineering Techniques

Here's a deeper look at each built-in technique and when to use it:

### Chain-of-Thought (CoT)

**Best for**: Math problems, logical reasoning, multi-step analysis, debugging code.

**How it works**: By instructing the model to "think step by step," you force it to externalize its reasoning process. This reduces errors on complex tasks because the model can catch mistakes in intermediate steps.

**Example injection**:
```
Before answering, think through this step-by-step:
1. Identify the key components of the problem
2. Analyze each component individually  
3. Synthesize your analysis into a final answer
Show your reasoning at each step.
```

### Few-Shot Examples

**Best for**: Classification, formatting, translation, any task where "show don't tell" is more effective than description.

**How it works**: Providing 2-5 input/output examples teaches the model the pattern you expect. The model generalizes from examples more reliably than from abstract instructions alone.

### Role Assignment

**Best for**: Domain-specific tasks, technical writing, code review, creative writing with a specific voice.

**How it works**: When you tell the model "You are a senior security engineer," it activates knowledge patterns associated with that role, producing more focused and authoritative responses.

### Output Structuring

**Best for**: API responses, data extraction, report generation, any task where downstream code needs to parse the output.

**How it works**: Explicit format instructions (with examples) ensure the model returns parseable, consistent output. Always provide a concrete example of the expected format.

### Self-Critique

**Best for**: High-stakes content, nuanced analysis, situations where first-draft quality isn't sufficient.

**How it works**: The model generates an initial response, then evaluates it for errors, gaps, or improvements, and produces a refined version. This two-pass approach catches issues a single generation might miss.

### Constraint Setting

**Best for**: Content policies, length-sensitive outputs, tasks with specific requirements or prohibitions.

**How it works**: Explicit constraints ("respond in under 100 words," "do not mention competitors," "always include a code example") give the model clear boundaries that reduce drift and off-topic content.

---

## Project Structure

```
promptforge/
├── promptforge.jsx      # Main application (single-file React component)
├── README.md            # This file — full project documentation
└── sample-prompts/      # (Optional) Example prompt configurations
    ├── code-review.json
    ├── translator.json
    └── summarizer.json
```

### File Breakdown

| File | Purpose | Lines | Key Technologies |
|---|---|---|---|
| `promptforge.jsx` | Full application: UI, state, API calls, techniques library | ~950 | React, Tailwind CSS, Fetch API |
| `README.md` | Documentation, architecture, usage guide | ~350 | Markdown |

---

## Technical Breakdown

### State Architecture

The application uses React's `useState` hook for all state management:

```
State Tree:
├── mode              → 'single' | 'ab'
├── systemPrompt      → string (system prompt text)
├── userPrompt        → string (user prompt text)
├── systemPromptB     → string (variant B system prompt)
├── userPromptB       → string (variant B user prompt)
├── variables         → Record<string, string>
├── variablesB        → Record<string, string>
├── temperature       → number (0.0 - 1.0)
├── maxTokens         → number (100 - 4096)
├── response          → string | null
├── responseB         → string | null
├── metrics           → { time, tokens, chars } | null
├── metricsB          → { time, tokens, chars } | null
├── history           → Array<HistoryEntry>
├── isLoading         → boolean
├── showTechniques    → boolean
├── showHistory       → boolean
└── showSettings      → boolean
```

### API Integration

The API call is wrapped in an async function with error handling:

1. Variable interpolation replaces all `{{var}}` patterns with their values
2. A `fetch` call is made to the Anthropic Messages endpoint
3. Response time is measured via `performance.now()` delta
4. Token count is estimated (characters / 4 approximation)
5. Results are stored in state and appended to history

### Variable Parsing

Variables are extracted from prompts using a regex pattern:

```javascript
/\{\{(\w+)\}\}/g
```

This captures any word characters between double curly braces, deduplicates them, and generates form inputs dynamically.

### Responsive Design

The UI adapts across breakpoints:
- Desktop: Full side-by-side layout in A/B mode
- Tablet: Stacked editors with side-by-side results
- Mobile: Fully stacked single-column layout

---

## Customization

### Adding New Techniques

Techniques are stored in a `TECHNIQUES` array. To add your own:

```javascript
{
  id: 'my-technique',
  name: 'My Custom Technique',
  icon: '🔧',
  description: 'A brief explanation of what this technique does.',
  template: `The actual text that gets injected into the system prompt.
Include {{variables}} if needed.`
}
```

### Changing the Model

Update the model string in the `runPrompt` function:

```javascript
model: "claude-sonnet-4-20250514"  // Change to any supported model
```

### Adjusting Token Estimation

The current estimation uses a simple characters/4 heuristic. For more accuracy, integrate a tokenizer library like `tiktoken` or use the Anthropic token counting API.

---

## Contributing

Contributions are welcome. Areas where help is particularly valuable:

- **Prompt technique library expansion** — Add new patterns with clear descriptions and examples
- **Response quality scoring** — Implement automated evaluation metrics
- **Prompt versioning** — Add Git-like diffing for prompt iterations
- **Batch testing** — Run a prompt against multiple inputs and aggregate results
- **Token counting accuracy** — Integrate a proper tokenizer

---

## License

MIT License. Use it, modify it, ship it.

---

Built with React, Tailwind CSS, and the Anthropic Claude API.
