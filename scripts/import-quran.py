"""Import Quran.com content unchanged and verify complete Madani pagination."""
import concurrent.futures, hashlib, json, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist/data'
FONTS = ROOT / '.font-cache'
PUBLIC_FONTS = ROOT / 'dist/assets/fonts'
DATA.mkdir(parents=True, exist_ok=True)
FONTS.mkdir(parents=True, exist_ok=True)
PUBLIC_FONTS.mkdir(parents=True, exist_ok=True)
RAW = ROOT / '.import-cache'
RAW.mkdir(exist_ok=True)
API = 'https://api.quran.com/api/v4'
GITHUB = 'https://raw.githubusercontent.com/quran/quran.com-frontend-next/master/'

def get(url):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'SamiMushaf/1.0', 'Accept': '*/*'})
            return urllib.request.urlopen(req, timeout=45).read()
        except Exception:
            if attempt == 4: raise
            time.sleep(1 + attempt)

def page(n):
    path = RAW / f'{n}.json'
    if path.exists(): return json.loads(path.read_text())
    verses, current = [], 1
    while True:
        raw = json.loads(get(f'{API}/verses/by_page/{n}?words=true&word_fields=text_uthmani,code_v2,v2_page,line_v2&fields=text_uthmani,v2_page,v1_page&per_page=50&page={current}&mushaf=1'))
        verses.extend(raw['verses'])
        current = raw.get('pagination', {}).get('next_page')
        if not current: break
    path.write_text(json.dumps(verses, ensure_ascii=False, separators=(',', ':')))
    return verses

def font(n):
    path = FONTS / f'p{n}.woff2'
    if not path.exists():
        b = get(GITHUB + f'public/fonts/quran/hafs/v2/woff2/p{n}.woff2')
        assert b[:4] == b'wOF2'
        path.write_bytes(b)
    return n

if __name__ == '__main__':
    chapters = json.loads(get(API + '/chapters?language=en'))['chapters']
    uthmani = get(GITHUB + 'public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2')
    (PUBLIC_FONTS / 'uthmani.woff2').write_bytes(uthmani)
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        raw_pages = list(ex.map(page, range(1, 605)))
    # The legacy by_page endpoint selects V1 verse ranges, even when words are
    # requested in V2. Rebuild V2 pages from the complete unique verse corpus,
    # using each word's explicit V2 page and line. Never discard boundary words.
    corpus = {v['verse_key']: v for raw_page in raw_pages for v in raw_page}
    assert len(corpus) == 6236, f'Incomplete corpus: {len(corpus)} verses'
    pages = [{'page': n, 'juz': None, 'verses': []} for n in range(1, 605)]
    for key, v in sorted(corpus.items(), key=lambda item: tuple(map(int, item[0].split(':')))):
        grouped = {}
        for w in v['words']:
            pn = w['v2_page']
            grouped.setdefault(pn, []).append([w['line_v2'], w['code_v2'], w['text_uthmani'], w['char_type_name']])
        for pn, words in grouped.items():
            pages[pn - 1]['verses'].append({'key': key, 'text': v['text_uthmani'], 'words': words})
            if pages[pn - 1]['juz'] is None: pages[pn - 1]['juz'] = v['juz_number']
    for p in pages:
        assert p['verses'], f'Empty V2 page {p["page"]}'
        assert all(1 <= w[0] <= 15 for v in p['verses'] for w in v['words'])
        (DATA / f'{p["page"]}.json').write_text(json.dumps(p, ensure_ascii=False, separators=(',', ':')))
    assert sum(len(v['words']) for p in pages for v in p['verses']) == sum(len(v['words']) for v in corpus.values()), 'Words lost during V2 pagination'
    for c in chapters:
        chapter_pages = [p['page'] for p in pages if any(v['key'].startswith(str(c['id']) + ':') for v in p['verses'])]
        c['pages'] = [min(chapter_pages), max(chapter_pages)]
    (DATA / 'chapters.json').write_text(json.dumps(chapters, ensure_ascii=False, separators=(',', ':')))
    print('All 604 V2 pages rebuilt from the complete word corpus.', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        list(ex.map(font, range(1, 605)))
    for n in range(1, 33):
        (PUBLIC_FONTS / f'p{n}.woff2').write_bytes((FONTS / f'p{n}.woff2').read_bytes())
    print('All 604 QCF V2 page fonts downloaded.', flush=True)
    original = json.loads(get(API + '/quran/verses/uthmani'))['verses']
    expected = {v['verse_key']: v['text_uthmani'] for v in original}
    found = {v['key']: v['text'] for p in pages for v in p['verses']}
    assert len(expected) == len(found) == 6236
    assert expected == found, 'Verse text differs from Quran.com bulk text'
    by_chapter = {str(c['id']): set() for c in chapters}
    for key in found: by_chapter[key.split(':')[0]].add(key)
    assert all(len(by_chapter[str(c['id'])]) == c['verses_count'] for c in chapters)
    index = [{'page': p['page'], 'juz': p['juz'], 'chapters': sorted(set(int(v['key'].split(':')[0]) for v in p['verses'])), 'first': p['verses'][0]['key'], 'last': p['verses'][-1]['key']} for p in pages]
    (DATA / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    report = {'source': API, 'imported_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'pages': 604, 'verses': len(found), 'chapters': len(chapters), 'text_integrity': 'Every verse equals Quran.com bulk Uthmani text, byte for byte', 'fonts': 'Quran.com QCF V2, all 604 page fonts', 'sha256': hashlib.sha256(json.dumps(found, ensure_ascii=False, sort_keys=True).encode()).hexdigest()}
    (DATA / 'provenance.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)
