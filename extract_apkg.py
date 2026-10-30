import zipfile
import sqlite3
import json
import os
import re
import html
from collections import defaultdict

APKG_PATH = 'MARROW Previous Year Question Papers.apkg'
OUTPUT_DIR = '.'
MEDIA_DIR = os.path.join(OUTPUT_DIR, 'media')
DATA_DIR = os.path.join(OUTPUT_DIR, 'data')

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

print("Step 1: Reading APKG zip archive...")
with zipfile.ZipFile(APKG_PATH, 'r') as z:
    # 1. Read media map
    print("Reading media mapping...")
    media_json = z.read('media').decode('utf-8')
    media_map = json.loads(media_json)
    print(f"Total media files mapped: {len(media_map)}")

    # Extract media files
    print("Extracting media files to media/...")
    extracted_count = 0
    for idx_str, real_name in media_map.items():
        if idx_str in z.namelist():
            target_path = os.path.join(MEDIA_DIR, real_name)
            if not os.path.exists(target_path) or os.path.getsize(target_path) == 0:
                with open(target_path, 'wb') as f:
                    f.write(z.read(idx_str))
            extracted_count += 1
            if extracted_count % 1000 == 0:
                print(f"  Extracted {extracted_count}/{len(media_map)} media files...")
    print(f"Media extraction complete: {extracted_count} files in {MEDIA_DIR}")

    # 2. Extract collection.anki2 to temp or memory
    print("Reading SQLite database...")
    db_data = z.read('collection.anki2')
    temp_db = os.path.join(DATA_DIR, 'temp_collection.anki2')
    with open(temp_db, 'wb') as f:
        f.write(db_data)

conn = sqlite3.connect(temp_db)
cursor = conn.cursor()

cursor.execute('SELECT decks, models FROM col')
decks_json, models_json = cursor.fetchone()
decks = json.loads(decks_json)
models = json.loads(models_json)

# Fetch all cards and notes
cursor.execute('''
    SELECT c.id, c.did, n.id, n.mid, n.flds, n.tags
    FROM cards c
    JOIN notes n ON c.nid = n.id
    ORDER BY c.did, c.id
''')
rows = cursor.fetchall()
print(f"Total cards loaded from database: {len(rows)}")

def fix_image_srcs(text):
    if not text:
        return ""
    # In Anki, <img src="xyz.jpg"> -> we point to media/xyz.jpg
    # Avoid double 'media/media/'
    def replace_src(match):
        src = match.group(1)
        if not src.startswith('media/') and not src.startswith('http'):
            return f'<img src="media/{src}"'
        return match.group(0)
    
    text = re.sub(r'<img[^>]+src=[\"\']([^\"\']+)[\"\']', replace_src, text)
    return text

# Group questions by subject
subjects_dict = defaultdict(lambda: {
    'name': '',
    'slug': '',
    'questions': [],
    'exams': set()
})

subject_names_clean = {
    'Anaesthesia': 'Anesthesia',
    'Anatomy': 'Anatomy',
    'Biochemistry': 'Biochemistry',
    'Community Medicine': 'Community Medicine (PSM)',
    'Dermatology': 'Dermatology',
    'ENT': 'ENT (Otorhinolaryngology)',
    'Forensic Medicine': 'Forensic Medicine & Toxicology',
    'Medicine': 'General Medicine',
    'Microbiology': 'Microbiology',
    'Obgy': 'Obstetrics & Gynaecology (OBGY)',
    'Opthalmology': 'Ophthalmology',
    'Orthopedics': 'Orthopaedics',
    'Paediatrics': 'Pediatrics',
    'Pathology': 'Pathology',
    'Pharmacology': 'Pharmacology',
    'Physiology': 'Physiology',
    'Psychiatry': 'Psychiatry',
    'Radiology': 'Radiology',
    'Surgery': 'General Surgery'
}

all_questions_list = []
exam_counts = defaultdict(int)
year_counts = defaultdict(int)

for row in rows:
    card_id, did, note_id, mid, flds, tags = row
    deck_name = decks.get(str(did), {}).get('name', '')
    
    parts = deck_name.split('::')
    raw_subject = parts[2] if len(parts) >= 3 else 'General'
    raw_exam = parts[3] if len(parts) >= 4 else 'General'
    
    clean_subject = subject_names_clean.get(raw_subject, raw_subject)
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', raw_subject).strip('_').lower()
    
    # Extract exam type and year
    exam_type = 'Other'
    if 'NEET' in raw_exam:
        exam_type = 'NEET PG'
    elif 'INI-CET' in raw_exam or 'INICET' in raw_exam:
        exam_type = 'INI-CET'
    elif 'AIIMS' in raw_exam:
        exam_type = 'AIIMS'
        
    year_match = re.search(r'20\d\d', raw_exam)
    year = int(year_match.group(0)) if year_match else None
    
    exam_counts[exam_type] += 1
    if year:
        year_counts[year] += 1

    # Split fields:
    # 0: Question, 1: MCQ_ID, 2-9: Options, 10: CorrectOption, 11: Explanation, 12: References, 13: CorrectIndex,
    # 14: Audio, 15: Video, 16: QuestionImages, 17: ExplanationImages
    fld_vals = flds.split('\x1f')
    q_text = fix_image_srcs(fld_vals[0] if len(fld_vals) > 0 else "")
    mcq_id = fld_vals[1] if len(fld_vals) > 1 else ""
    
    # Options (Options 1 to 4 or more)
    options = []
    for opt_idx in range(2, 10):
        if opt_idx < len(fld_vals) and fld_vals[opt_idx].strip():
            opt_text = fix_image_srcs(fld_vals[opt_idx].strip())
            options.append(opt_text)
            
    correct_opt_text = fld_vals[10] if len(fld_vals) > 10 else ""
    explanation = fix_image_srcs(fld_vals[11] if len(fld_vals) > 11 else "")
    references = fix_image_srcs(fld_vals[12] if len(fld_vals) > 12 else "")
    
    correct_index_str = fld_vals[13] if len(fld_vals) > 13 else ""
    try:
        correct_index = int(correct_index_str)
    except:
        correct_index = 0
        for i, opt in enumerate(options):
            if opt.strip() == correct_opt_text.strip():
                correct_index = i
                break

    q_img = fix_image_srcs(fld_vals[16] if len(fld_vals) > 16 else "")
    exp_img = fix_image_srcs(fld_vals[17] if len(fld_vals) > 17 else "")
    
    # If question images not already in q_text, append
    if q_img:
        # Check if img tags in q_img are in q_text
        imgs = re.findall(r'<img[^>]+src=[\"\']([^\"\']+)[\"\']', q_img)
        for img in imgs:
            if img not in q_text:
                q_text += f"<br/>{q_img}"
                break
                
    if exp_img:
        imgs = re.findall(r'<img[^>]+src=[\"\']([^\"\']+)[\"\']', exp_img)
        for img in imgs:
            if img not in explanation:
                explanation += f"<br/>{exp_img}"
                break

    has_images = bool('<img' in q_text or '<img' in explanation)
    
    q_data = {
        'id': card_id,
        'mcq_id': mcq_id,
        'subject': clean_subject,
        'subject_slug': slug,
        'deck': raw_exam,
        'exam_type': exam_type,
        'year': year,
        'question': q_text,
        'options': options,
        'correct_index': correct_index,
        'correct_answer': correct_opt_text,
        'explanation': explanation,
        'references': references,
        'has_images': has_images
    }
    
    subjects_dict[slug]['name'] = clean_subject
    subjects_dict[slug]['slug'] = slug
    subjects_dict[slug]['questions'].append(q_data)
    subjects_dict[slug]['exams'].add(raw_exam)
    all_questions_list.append(q_data)

conn.close()
if os.path.exists(temp_db):
    os.remove(temp_db)

# Save subjects summary JSON
subjects_summary = []
for slug, s_data in subjects_dict.items():
    subjects_summary.append({
        'name': s_data['name'],
        'slug': slug,
        'count': len(s_data['questions']),
        'exams': sorted(list(s_data['exams']))
    })
subjects_summary.sort(key=lambda x: -x['count'])

with open(os.path.join(DATA_DIR, 'subjects.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'total_questions': len(all_questions_list),
        'total_subjects': len(subjects_summary),
        'subjects': subjects_summary,
        'exam_counts': exam_counts,
        'year_counts': dict(sorted(year_counts.items()))
    }, f, indent=2)

print(f"\nSaved {len(subjects_summary)} subjects to data/subjects.json")

# Save each subject's full questions JSON
for slug, s_data in subjects_dict.items():
    filepath = os.path.join(DATA_DIR, f"{slug}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump({
            'subject': s_data['name'],
            'slug': slug,
            'count': len(s_data['questions']),
            'questions': s_data['questions']
        }, f, ensure_ascii=False)
    print(f"  Saved data/{slug}.json ({len(s_data['questions'])} questions)")

# Also create a compact global search index (id, mcq_id, subject_slug, question_snippet, exam, year)
search_index = []
for q in all_questions_list:
    # clean plain text preview
    clean_q = re.sub(r'<[^>]+>', ' ', q['question'])
    clean_q = ' '.join(clean_q.split())[:120]
    search_index.append({
        'id': q['id'],
        'mid': q['mcq_id'],
        'sub': q['subject_slug'],
        'q': clean_q,
        'ex': q['exam_type'],
        'yr': q['year']
    })

with open(os.path.join(DATA_DIR, 'search_index.json'), 'w', encoding='utf-8') as f:
    json.dump(search_index, f, separators=(',', ':'))

print(f"Saved search index with {len(search_index)} items to data/search_index.json")
print("\nExtraction and data preparation complete!")

