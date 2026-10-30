import json
import os
import subprocess
import sys
import tempfile

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DATA_DIR = "data"
PDF_DIR = "pdfs"
MEDIA_DIR = "media"

os.makedirs(PDF_DIR, exist_ok=True)

def generate_subject_pdf(slug):
    json_path = os.path.join(DATA_DIR, f"{slug}.json")
    if not os.path.exists(json_path):
        print(f"Error: {json_path} does not exist.")
        return None

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    subject_name = data['subject']
    questions = data['questions']
    total_q = len(questions)

    print(f"\n[+] Compiling PDF for {subject_name} ({total_q} questions)...")

    media_abs = os.path.abspath(MEDIA_DIR).replace('\\', '/')

    html_cards = []
    option_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

    for idx, q in enumerate(questions, 1):
        q_text = q['question'].replace('media/', f'file:///{media_abs}/')
        exp_text = q['explanation'].replace('media/', f'file:///{media_abs}/')
        ref_text = q['references'].replace('media/', f'file:///{media_abs}/')

        opt_html = ""
        for o_idx, opt in enumerate(q['options']):
            letter = option_letters[o_idx] if o_idx < len(option_letters) else f"({o_idx+1})"
            is_correct = (o_idx == q['correct_index'])
            correct_class = "correct-opt" if is_correct else ""
            mark = '<span class="check">&#10004;</span> ' if is_correct else ''
            opt_clean = opt.replace('media/', f'file:///{media_abs}/')
            opt_html += f'<div class="opt-item {correct_class}"><span class="opt-badge">{letter}</span> <div class="opt-content">{mark}{opt_clean}</div></div>'

        ref_block = f'<div class="ref-block"><strong>References:</strong> {ref_text}</div>' if ref_text.strip() else ""

        exam_badge = q.get('deck', '')
        mcq_id = q.get('mcq_id', '')
        meta_info = f'<span class="badge exam-badge">{exam_badge}</span>'
        if mcq_id:
            meta_info += f' <span class="badge id-badge">ID: {mcq_id}</span>'

        card_html = f"""
        <div class="question-card">
            <div class="card-meta">
                <span class="q-num">Q{idx}.</span>
                {meta_info}
            </div>
            <div class="q-body">{q_text}</div>
            <div class="options-container">
                {opt_html}
            </div>
            <div class="explanation-box">
                <div class="exp-title">Correct Answer: {q.get('correct_answer', '')}</div>
                <div class="exp-content">{exp_text}</div>
                {ref_block}
            </div>
        </div>
        """
        html_cards.append(card_html)

    full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{subject_name} - Marrow Previous Year Questions</title>
    <style>
        @page {{
            size: A4;
            margin: 12mm 10mm 15mm 10mm;
        }}
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            font-size: 10.5pt;
            line-height: 1.45;
            background: #fff;
            margin: 0;
            padding: 0;
        }}
        .header {{
            border-bottom: 2px solid #2563eb;
            padding-bottom: 8px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }}
        .header h1 {{
            margin: 0;
            font-size: 16pt;
            color: #1e3a8a;
        }}
        .header .subtitle {{
            font-size: 9pt;
            color: #64748b;
            margin-top: 3px;
        }}
        .header .meta {{
            text-align: right;
            font-size: 8.5pt;
            color: #475569;
        }}
        .question-card {{
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 12px;
            background: #ffffff;
        }}
        .card-meta {{
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
        }}
        .q-num {{
            font-weight: 800;
            font-size: 11pt;
            color: #1d4ed8;
        }}
        .badge {{
            display: inline-block;
            font-size: 8pt;
            padding: 2px 5px;
            border-radius: 4px;
            font-weight: 600;
        }}
        .exam-badge {{
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
        }}
        .id-badge {{
            background: #f1f5f9;
            color: #475569;
        }}
        .q-body {{
            font-size: 10.5pt;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 8px;
            word-wrap: break-word;
        }}
        .q-body img, .exp-content img {{
            max-width: 85%;
            max-height: 240px;
            display: block;
            margin: 6px auto;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }}
        .options-container {{
            margin-left: 2px;
            margin-bottom: 8px;
        }}
        .opt-item {{
            display: flex;
            align-items: flex-start;
            gap: 6px;
            padding: 3px 6px;
            margin-bottom: 2px;
            border-radius: 4px;
            font-size: 10pt;
        }}
        .opt-badge {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #f1f5f9;
            color: #475569;
            font-size: 8.5pt;
            font-weight: 700;
            flex-shrink: 0;
            margin-top: 1px;
        }}
        .opt-content {{
            flex: 1;
        }}
        .opt-item.correct-opt {{
            background: #ecfdf5;
            color: #065f46;
            font-weight: 600;
            border-left: 3px solid #10b981;
        }}
        .opt-item.correct-opt .opt-badge {{
            background: #10b981;
            color: #fff;
        }}
        .check {{
            color: #059669;
            font-weight: bold;
        }}
        .explanation-box {{
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 0 4px 4px 0;
            padding: 6px 10px;
            margin-top: 6px;
            font-size: 9.5pt;
            color: #334155;
        }}
        .exp-title {{
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 3px;
        }}
        .exp-content p {{
            margin: 3px 0;
        }}
        .ref-block {{
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
            font-size: 8pt;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>{subject_name} - Previous Year Questions</h1>
            <div class="subtitle">Marrow Q-Bank Collection &bull; NEET PG / INI-CET / AIIMS (2017-2025)</div>
        </div>
        <div class="meta">
            <div>Total Questions: {total_q}</div>
            <div>High-Yield Study Edition</div>
        </div>
    </div>
    {"".join(html_cards)}
</body>
</html>"""

    temp_html = os.path.join(tempfile.gettempdir(), f"marrow_temp_{slug}.html")
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(full_html)

    pdf_out = os.path.abspath(os.path.join(PDF_DIR, f"{slug}_PYQ.pdf"))
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--allow-file-access-from-files",
        f"--print-to-pdf={pdf_out}",
        temp_html
    ]
    subprocess.run(cmd, check=True)

    if os.path.exists(temp_html):
        os.remove(temp_html)

    size_mb = os.path.getsize(pdf_out) / (1024 * 1024)
    print(f"[✓] Generated: {pdf_out} ({size_mb:.2f} MB)")
    return pdf_out

if __name__ == '__main__':
    if len(sys.argv) > 1:
        target = sys.argv[1].lower()
        if target == 'all':
            with open(os.path.join(DATA_DIR, 'subjects.json'), 'r', encoding='utf-8') as f:
                subs = json.load(f)['subjects']
            for s in subs:
                generate_subject_pdf(s['slug'])
        else:
            generate_subject_pdf(target)
    else:
        # Default: generate a set of high-yield subject booklets
        print("Usage: python generate_pdfs.py [subject_slug | all]")
        print("Generating starter PDF booklets...")
        for sample in ['anaesthesia', 'psychiatry', 'radiology', 'dermatology']:
            generate_subject_pdf(sample)
