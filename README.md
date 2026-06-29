# Design Prep Papers 🎨

A simple, open-source archive of design entrance exam question papers and answer keys. This repository serves as a centralized collection for students preparing for design exams like **UCEED** and **CEED**, with plans to expand to other design exams in the future.

To help you practice directly, this archive includes a built-in interactive prep workspace. You can open any paper in your browser, draw/sketch annotations directly on top of the sheets, fill out OMR responses, and check your grades in real-time.

👉 **Practice Online: [design-prep-papers.vercel.app](https://design-prep-papers.vercel.app)**

---

## 📂 Papers Collection Index

All papers, including official answer keys (where available), are structured cleanly inside the `public/data/` directory and can be accessed directly.

### 1. UCEED (Undergraduate Common Entrance Examination for Design)
A collection of UCEED question papers and keys from 2015 to 2026:
* **2026**: [Question Paper](public/data/uceed/uceed-2026-q.pdf) | [Answer Key](public/data/uceed/uceed-2026-a.pdf)
* **2025**: [Question Paper](public/data/uceed/uceed-2025-q.pdf) | [Answer Key](public/data/uceed/uceed-2025-a.pdf)
* **2024**: [Question Paper](public/data/uceed/uceed-2024-q.pdf) | [Answer Key](public/data/uceed/uceed-2024-a.pdf)
* **2023**: [Question Paper](public/data/uceed/uceed-2023-q.pdf) | [Answer Key](public/data/uceed/uceed-2023-a.pdf)
* **2022**: [Question Paper](public/data/uceed/uceed-2022-q.pdf) | [Answer Key](public/data/uceed/uceed-2022-a.pdf)
* **2021**: [Question Paper](public/data/uceed/uceed-2021-q.pdf) | [Answer Key](public/data/uceed/uceed-2021-a.pdf)
* **2020**: [Question Paper](public/data/uceed/uceed-2020-q.pdf) | [Answer Key](public/data/uceed/uceed-2020-a.pdf)
* **2019**: [Question Paper](public/data/uceed/uceed-2019-q.pdf) | [Answer Key](public/data/uceed/uceed-2019-a.pdf)
* **2018**: [Question Paper](public/data/uceed/uceed-2018-q.pdf) | [Answer Key](public/data/uceed/uceed-2018-a.pdf)
* **2017**: [Question Paper](public/data/uceed/uceed-2017-q.pdf) | [Answer Key](public/data/uceed/uceed-2017-a.pdf)
* **2016**: [Question Paper](public/data/uceed/uceed-2016-q.pdf) | [Answer Key](public/data/uceed/uceed-2016-a.pdf)
* **2015**: [Question Paper](public/data/uceed/uceed-2015-q.pdf) | [Answer Key](public/data/uceed/uceed-2015-a.pdf)

### 2. CEED (Common Entrance Examination for Design)
A collection of CEED question papers and keys from 2010 to 2026:
* **2026**: [Question Paper](public/data/ceed/ceed-2026-q.pdf) | [Answer Key](public/data/ceed/ceed-2026-a.pdf)
* **2025**: [Question Paper](public/data/ceed/ceed-2025-q.pdf) | [Answer Key](public/data/ceed/ceed-2025-a.pdf)
* **2024**: [Question Paper](public/data/ceed/ceed-2024-q.pdf) | [Answer Key](public/data/ceed/ceed-2024-a.pdf)
* **2023**: [Question Paper](public/data/ceed/ceed-2023-q.pdf) | [Answer Key](public/data/ceed/ceed-2023-a.pdf)
* **2022**: [Question Paper](public/data/ceed/ceed-2022-q.pdf) | [Answer Key](public/data/ceed/ceed-2022-a.pdf)
* **2021**: [Question Paper](public/data/ceed/ceed-2021-q.pdf) | [Answer Key](public/data/ceed/ceed-2021-a.pdf)
* **2020**: [Question Paper](public/data/ceed/ceed-2020-q.pdf) | [Answer Key](public/data/ceed/ceed-2020-a.pdf)
* **2019 - 2010**: Question papers for [2019](public/data/ceed/ceed-2019-q.pdf), [2018](public/data/ceed/ceed-2018-q.pdf), [2017](public/data/ceed/ceed-2017-q.pdf), [2016](public/data/ceed/ceed-2016-q.pdf), [2015](public/data/ceed/ceed-2015-q.pdf), [2014](public/data/ceed/ceed-2014-q.pdf), [2013](public/data/ceed/ceed-2013-q.pdf), [2012](public/data/ceed/ceed-2012-q.pdf), [2011](public/data/ceed/ceed-2011-q.pdf), and [2010](public/data/ceed/ceed-2010-q.pdf) are available.

---

## 📝 Practice Workspace Features
If you use the online link to solve these papers, the web app provides a workspace simulating the exam environment:
* **Interactive Canvas**: Use a stylus, mouse, or touch input to sketch notes, mark options, or draft answers directly on top of the question sheets.
* **Scrollable PDF Viewer**: View entire papers smoothly with native scroll support.
* **Side-by-Side OMR Sheet**: Select choices (MCQs, MSQs) or enter values (NATs) on a digital answer sheet.
* **Automatic Grading**: Instant score calculation based on official marking schemes (including positive/negative scoring).
* **Progress Recovery**: Your drawing strokes, answers, and timers are saved automatically to your browser storage (IndexedDB) so you never lose your progress.

---

## 🛠️ Local Setup & Technical Info

If you want to run the workspace app locally on your computer:

1. Clone this repository:
   ```bash
   git clone https://github.com/rudy0Z/design-prep-papers.git
   cd design-prep-papers
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to start practicing.

*Built with Next.js 16, TypeScript, Vanilla CSS, and PDF.js.*
