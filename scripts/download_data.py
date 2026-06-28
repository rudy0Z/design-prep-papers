import os
import re
import json
import urllib.request
import pypdf
import io

# Define source URLs
CEED_BASE = "https://www.ceed.iitb.ac.in/2026/downloads/"
UCEED_BASE = "https://www.uceed.iitb.ac.in/2026/assets/downloads/qps/"

# Define output dirs
PUBLIC_DATA_DIR = "public/data"
CEED_DIR = os.path.join(PUBLIC_DATA_DIR, "ceed")
UCEED_DIR = os.path.join(PUBLIC_DATA_DIR, "uceed")

os.makedirs(CEED_DIR, exist_ok=True)
os.makedirs(UCEED_DIR, exist_ok=True)

# List of papers to download
CEED_PAPERS = [
    {"year": 2026, "q": "CEED_2026_Question_Paper.pdf", "a": "CEED_2026_Answer_Key.pdf"},
    {"year": 2025, "q": "CEED_2025_Question_Paper.pdf", "a": "CEED_2025_Answer_Key.pdf"},
    {"year": 2024, "q": "CEED_2024_Question_Paper.pdf", "a": "CEED_2024_Answer_Key.pdf"},
    {"year": 2023, "q": "CEED_2023_Question_Paper.pdf", "a": "CEED_2023_Answer_Key.pdf"},
    {"year": 2022, "q": "CEED_2022_Qestion_Paper.pdf", "a": "CEED_2022_Answer_Key.pdf"},
    {"year": 2021, "q": "CEED_2021_Question_Paper.pdf", "a": "CEED_2021_Final_Answer_Keys.pdf"},
    {"year": 2020, "q": "CEED2020qp.pdf", "a": "CEED2020ans.pdf"},
    {"year": 2019, "q": "CEED2019qp.pdf", "a": None},
    {"year": 2018, "q": "CEED2018qp.pdf", "a": None},
    {"year": 2017, "q": "CEED2017qp.pdf", "a": None},
    {"year": 2016, "q": "CEED2016qp1.pdf", "a": None},
    {"year": 2015, "q": "CEED2015qp.pdf", "a": None},
    {"year": 2014, "q": "CEED2014qp.pdf", "a": None},
    {"year": 2013, "q": "CEED2013qp.pdf", "a": None},
    {"year": 2012, "q": "CEED2012qp.pdf", "a": None},
    {"year": 2011, "q": "CEED2011qp.pdf", "a": None},
    {"year": 2010, "q": "CEED2010qp.pdf", "a": None},
]

UCEED_PAPERS = [
    {"year": 2026, "q": "UCEED_2026_Question_Paper.pdf", "a": "UCEED2026_Answer_Key.pdf"},
    {"year": 2025, "q": "UCEED_2025_Question_Paper.pdf", "a": "UCEED2025_Answer_Key.pdf"},
    {"year": 2024, "q": "UCEED_2024_Question_Paper.pdf", "a": "UCEED2024_Answer_Key.pdf"},
    {"year": 2023, "q": "UCEED_2023_Question_Paper.pdf", "a": "UCEED2023_Answer_Key.pdf"},
    {"year": 2022, "q": "UCEED2022_Question_Paper.pdf", "a": "UCEED2022_Answer_Key.pdf"},
    {"year": 2021, "q": "UCEED2021_Question_Paper.pdf", "a": "UCEED2021_Answer_Key.pdf"},
    {"year": 2020, "q": "UCEED2020_Question_Paper.pdf", "a": "UCEED2020_Answer_Key.pdf"},
    {"year": 2019, "q": "UCEED2019_Question_Paper.pdf", "a": "UCEED2019_Answer_Key.pdf"},
    {"year": 2018, "q": "UCEED2018_Question_Paper.pdf", "a": "UCEED2018_Answer_Key.pdf"},
    {"year": 2017, "q": "UCEED2017_Question_Paper.pdf", "a": "UCEED2017_Answer_Key.pdf"},
    {"year": 2016, "q": "UCEED2016_Question_Paper.pdf", "a": "UCEED2016_Answer_Key.pdf"},
    {"year": 2015, "q": "UCEED2015_Question_Paper.pdf", "a": "UCEED2015_Answer_Key.pdf"},
]

def download_file(url, dest_path):
    if os.path.exists(dest_path):
        print(f"Skipping (already exists): {dest_path}")
        return True
    
    print(f"Downloading {url} -> {dest_path}")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            with open(dest_path, "wb") as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def parse_answer_key(file_path):
    if not file_path or not os.path.exists(file_path):
        return None
    
    print(f"Parsing answer key: {file_path}")
    try:
        reader = pypdf.PdfReader(file_path)
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() + "\n"
        
        # Clean text
        full_text = re.sub(r'\s+', ' ', full_text)
        
        sections = {
            "NAT": {},
            "MSQ": {},
            "MCQ": {}
        }
        
        # Split text into sections
        # Match headings like "SECTION - A (NAT)" or "SECTION - I (NAT)"
        sec_matches = list(re.finditer(r'SECTION\s*[-–]\s*([A-C I-V]+)\s*\((NAT|MSQ|MCQ)\)', full_text, re.IGNORECASE))
        
        if not sec_matches:
            # Try alternate pattern
            sec_matches = list(re.finditer(r'SECTION\s*[-–]\s*([A-C I-V]+)\s*[:]\s*(NAT|MSQ|MCQ)', full_text, re.IGNORECASE))
        
        # Fallback if no sections are found but it has Q. No / Keys
        if not sec_matches:
            print("  Warning: No section headers detected in text.")
            return None
            
        for idx, match in enumerate(sec_matches):
            sec_type = match.group(2).upper()
            start_pos = match.end()
            end_pos = sec_matches[idx+1].start() if idx + 1 < len(sec_matches) else len(full_text)
            sec_text = full_text[start_pos:end_pos]
            
            # Parse questions depending on section type
            if sec_type == "NAT":
                # Matches patterns like "01 20", "01 6 to 6.5", "12 16.8", "14 470 - 480"
                # Parse sequence of Q.No and key/range: e.g. "01 6 to 6.5 02 126 to 128"
                pairs = re.findall(r'\b(\d+)\s+([0-9.]+(?:\s*(?:to|-)\s*[0-9.]+)?)(?=\s+\d+|\s*$)', sec_text, re.IGNORECASE)
                for q_num_str, val_str in pairs:
                    q_num = int(q_num_str)
                    val_str = val_str.strip()
                    if q_num > 60:
                        continue
                    sections["NAT"][str(q_num)] = val_str
            
            elif sec_type == "MSQ":
                # Matches patterns like "15 B, D", "16 A, C, D", "15 A,B,C"
                # MSQ keys can contain letters separated by commas or spaces, sometimes "or"
                # Regex matches number followed by combination of letters A, B, C, D and commas/spaces
                pairs = re.findall(r'(\d+)\s+([A-D,\s]+(?:or\s+[A-D,\s]+)?)', sec_text, re.IGNORECASE)
                for q_num_str, val_str in pairs:
                    q_num = int(q_num_str)
                    val_str = val_str.strip()
                    if q_num > 60:
                        continue
                    
                    # Convert "A, B" to ["A", "B"]
                    # If there's an "or", handle multiple allowed answers
                    sub_options = []
                    if "or" in val_str.lower():
                        parts = re.split(r'\s+or\s+', val_str, flags=re.IGNORECASE)
                        for part in parts:
                            opts = [o.strip().upper() for o in re.findall(r'[A-D]', part, re.IGNORECASE)]
                            if opts:
                                sub_options.append(opts)
                    else:
                        opts = [o.strip().upper() for o in re.findall(r'[A-D]', val_str, re.IGNORECASE)]
                        if opts:
                            sub_options.append(opts)
                    
                    if sub_options:
                        # If only one set of options, save as array, otherwise save list of arrays
                        sections["MSQ"][str(q_num)] = sub_options[0] if len(sub_options) == 1 else sub_options

            elif sec_type == "MCQ":
                # Matches patterns like "30 D", "31 B"
                # Look for single character keys A, B, C, D
                pairs = re.findall(r'(\d+)\s+([A-D]|Dropped)', sec_text, re.IGNORECASE)
                for q_num_str, val_str in pairs:
                    q_num = int(q_num_str)
                    val_str = val_str.strip().upper()
                    if q_num > 60:
                        continue
                    sections["MCQ"][str(q_num)] = val_str
                    
        # Verify if we parsed anything
        if not sections["NAT"] and not sections["MSQ"] and not sections["MCQ"]:
            # Let's try matching general key pattern: \d+\s+[A-D](?:,\s*[A-D])* or numerical values
            print("  Warning: Standard parsing empty. Trying fallback parser...")
            # Fallback parsing regex
            all_pairs = re.findall(r'(\d+)\s+([A-D](?:\s*,\s*[A-D])*|[0-9\.\-\s]+to[0-9\.\-\s]+|[0-9\.]+)\b', full_text)
            for q_num_str, val_str in all_pairs:
                q_num = int(q_num_str)
                val_str = val_str.strip()
                if q_num > 60:
                    continue
                # Classify based on question index
                # CEED: 1-8 NAT, 9-18 MSQ, 19-44 MCQ
                # UCEED: 1-14 NAT, 15-29 MSQ, 30-57 MCQ
                # We will place it in sections temporarily and let the master config sort it
                # For safety, let's keep it simple.
                pass
            
        print(f"  Parsed keys counts: NAT={len(sections['NAT'])}, MSQ={len(sections['MSQ'])}, MCQ={len(sections['MCQ'])}")
        return sections
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return None

def build_manifest():
    manifest = []
    
    # Process CEED
    for paper in CEED_PAPERS:
        year = paper["year"]
        q_file = f"ceed-{year}-q.pdf"
        a_file = f"ceed-{year}-a.pdf" if paper["a"] else None
        
        q_url = CEED_BASE + paper["q"]
        a_url = CEED_BASE + paper["a"] if paper["a"] else None
        
        q_local = os.path.join(CEED_DIR, q_file)
        a_local = os.path.join(CEED_DIR, a_file) if a_file else None
        
        q_ok = download_file(q_url, q_ok_path := q_local)
        a_ok = download_file(a_url, a_ok_path := a_local) if a_url else False
        
        # Parse answers
        answers = None
        if a_ok and a_local:
            answers = parse_answer_key(a_local)
            
        # Standard CEED sections: NAT 1-8, MSQ 9-18, MCQ 19-44
        # We can dynamically set sections based on year if they differed, but standard is:
        # CEED 2026/2025/2024/2023/2022/2021/2020: NAT 8 (1-8), MSQ 10 (9-18), MCQ 26 (19-44)
        # Prior to 2020, CEED pattern might be different. Let's provide default layout structures:
        sections = [
            { "id": "sec-1", "type": "NAT", "count": 8, "startQ": 1 },
            { "id": "sec-2", "type": "MSQ", "count": 10, "startQ": 9 },
            { "id": "sec-3", "type": "MCQ", "count": 26, "startQ": 19 }
        ]
        
        manifest.append({
            "id": f"ceed-{year}",
            "exam": "CEED",
            "year": year,
            "pdfPath": f"/data/ceed/{q_file}",
            "ansPath": f"/data/ceed/{a_file}" if a_file else None,
            "sections": sections,
            "keys": answers
        })
        
    # Process UCEED
    for paper in UCEED_PAPERS:
        year = paper["year"]
        q_file = f"uceed-{year}-q.pdf"
        a_file = f"uceed-{year}-a.pdf" if paper["a"] else None
        
        q_url = UCEED_BASE + paper["q"]
        a_url = UCEED_BASE + paper["a"] if paper["a"] else None
        
        q_local = os.path.join(UCEED_DIR, q_file)
        a_local = os.path.join(UCEED_DIR, a_file) if a_file else None
        
        q_ok = download_file(q_url, q_local)
        a_ok = download_file(a_url, a_local) if a_url else False
        
        # Parse answers
        answers = None
        if a_ok and a_local:
            answers = parse_answer_key(a_local)
            
        # Standard UCEED sections: NAT 14 (1-14), MSQ 15 (15-29), MCQ 28 (30-57)
        # This has been the standard UCEED pattern for Part A for many years.
        sections = [
            { "id": "sec-1", "type": "NAT", "count": 14, "startQ": 1 },
            { "id": "sec-2", "type": "MSQ", "count": 15, "startQ": 15 },
            { "id": "sec-3", "type": "MCQ", "count": 28, "startQ": 30 }
        ]
        
        manifest.append({
            "id": f"uceed-{year}",
            "exam": "UCEED",
            "year": year,
            "pdfPath": f"/data/uceed/{q_file}",
            "ansPath": f"/data/uceed/{a_file}" if a_file else None,
            "sections": sections,
            "keys": answers
        })
        
    # Save manifest.json
    manifest_path = os.path.join(PUBLIC_DATA_DIR, "papers.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest written successfully to {manifest_path}")

if __name__ == "__main__":
    build_manifest()
