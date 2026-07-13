const fs = require('fs');
const path = require('path');

async function analyzeOldPapers() {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const years = [2010, 2011, 2012, 2013];
    
    for (const year of years) {
      const filePath = path.join(__dirname, 'public', 'data', 'ceed', `ceed-${year}-q.pdf`);
      if (!fs.existsSync(filePath)) {
        console.log(`CEED ${year}: file not found`);
        continue;
      }
      
      const data = new Uint8Array(fs.readFileSync(filePath));
      const loadingTask = pdfjs.getDocument({ data });
      const pdf = await loadingTask.promise;
      
      console.log(`\n================ CEED ${year} (Pages: ${pdf.numPages}) ================`);
      
      // Let's search for occurrences of questions on each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        
        // Find question mentions like Q1, Q2, Question, Question No. etc.
        const qMatches = [...text.matchAll(/(?:Question\s+(?:No\.)?\s*(\d+))|(?:\bQ\s*(\d+)\b)/gi)];
        const qids = qMatches.map(m => m[1] || m[2]).filter((v, idx, self) => self.indexOf(v) === idx);
        
        const hasPartA = /PART\s*A/i.test(text);
        const hasPartB = /PART\s*B/i.test(text);
        
        const snippet = text.replace(/\s+/g, ' ').substring(0, 180);
        console.log(`Page ${pageNum}: QsFound=${JSON.stringify(qids)} | PartA=${hasPartA} | PartB=${hasPartB} | Text="${snippet}"`);
      }
    }
  } catch (err) {
    console.error('Error in analyzeOldPapers:', err);
  }
}

analyzeOldPapers();
