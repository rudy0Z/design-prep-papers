# Design Prep Papers 🎨📝

A premium, highly interactive exam cockpit designed specifically for design students prepping for entrance exams like **UCEED**, **CEED**, and **NID**.

Built with a **Notion-meets-Linear** design aesthetic—prioritizing restraint, extreme hierarchy, and absolute visual clarity over generic "AI-site" decorations.

## 🚀 Live Demo
Deploy and check out the live app hosted on Vercel: **[design-prep-papers.vercel.app](https://design-prep-papers.vercel.app)** *(Link updated upon deployment)*

---

## ✨ Features

### 📐 1. PDF Canvas & Drawing Layer
* **Zero-Network PDF Transport**: Fetches PDFs directly as binary arrays to bypass server chunk interception, ensuring robust performance.
* **Pixel-Perfect Canvas Annotation**: Seamless vector-based overlay drawing layer using canvas, optimized for tablet, mouse, and stylus devices.
* **Precision Controls**: Adjust brush stroke size and swap between accent-colored ink, clear annotations, and custom grid tools.

### 📝 2. Side-by-Side Interactive OMR Sheet
* **Mock Exam Modes**: Designed to replicate actual exam patterns (Part A & Part B).
* **Multi-Format Input Support**: Fully supports NAT (Numerical Answer Type), MSQ (Multiple Select Questions), and MCQ (Multiple Choice Questions) inputs.
* **Collapsible Workspace Layout**: Responsive layout with a collapsible secondary OMR panel to maximize reading canvas real estate.

### ⚡ 3. Real-Time Grading & Analytics
* **Scoring Rules Engine**: Supports exact positive/negative markings matching official exam guidelines.
* **Performance Dashboard**: Immediate score computation, answer sheets comparisons, and correction analysis.
* **State Recovery & Persistence**: Answers and vector strokes are saved locally to IndexedDB/localStorage, protecting your progress from browser crashes or network drops.

---

## 🛠️ Tech Stack
* **Framework**: Next.js 16 (App Router, Turbopack)
* **Language**: TypeScript
* **Styling**: Vanilla CSS (CSS Variables, clean flexbox/grid layout)
* **PDF Engine**: PDF.js (`pdfjs-dist`)
* **State & Storage**: IndexedDB (for local drawing stroke data), LocalStorage (session data, answer sheets)

---

## 📦 Project Structure
```text
├── public/
│   ├── data/            # Local JSON databases containing metadata and answer keys
│   └── pdf.worker.min.mjs
├── src/
│   ├── app/
│   │   ├── api/pdf/     # Safe PDF proxy bypass router
│   │   ├── layout.tsx
│   │   └── page.tsx     # Homepage / Dashboard
│   ├── components/      # UI Components (Header, Workspace, PdfViewer, OmrSheet, etc.)
│   ├── utils/           # Helper libraries (scoring engine, local storage, DB sync)
│   └── index.css        # Global CSS variables and typography system
```

---

## 🚦 Getting Started

### Prerequisites
* **Node.js**: `v18.x` or later
* **npm** or **yarn**

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/rudy0Z/design-prep-papers.git
   cd design-prep-papers
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

---

## 🧑‍🎨 Design Philosophy
* **Hierarchy First**: Colors are used strictly for state, errors, scoring, and interaction—never for decoration.
* **Dense but Readable**: High-density layouts designed to feel like a real-world test cockpit, providing a calm, focused reading environment.
* **Zero Bloat**: No flashy AI landing page headers, gradients, shadows, or marketing banners. A professional tool for professional study.
