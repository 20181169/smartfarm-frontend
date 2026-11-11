"""Add local dataset photos with real rice inference. No DB or network access."""
import argparse
import csv
import hashlib
import json
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--rice-root', type=Path, required=True)
parser.add_argument('--vision-root', type=Path, required=True)
parser.add_argument('--output', type=Path, default=Path('public/demo/farming'))
args = parser.parse_args()
sys.path.insert(0, str(args.vision_root.resolve()))
from rice_stage import RiceStageClassifier

manifest_path = args.output / 'analyses.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
dataset = args.rice_root / 'rice_stage_unified_v3'
rows = list(csv.DictReader((dataset / 'manifest.csv').open(encoding='utf-8-sig', newline='')))
classifier = RiceStageClassifier()
classifier.device = 'cpu'
now = datetime.now(timezone.utc).isoformat()
items = manifest['items']
existing = {item['id'] for item in items}
destination = args.output / 'rice'
destination.mkdir(parents=True, exist_ok=True)
for stage in ['SOWING', 'VEGETATIVE', 'FLOWERING', 'HARVEST']:
    candidates = sorted([r for r in rows if r['split'] == 'test' and r['stage'] == stage], key=lambda r: r['date'])
    if len(candidates) < 6:
        raise RuntimeError(f'Insufficient local samples: {stage}')
    for i in range(6):
        row = candidates[round(i * (len(candidates) - 1) / 5)]
        source = dataset / row['file']
        photo_id = 'rice-extra-' + hashlib.sha256(row['file'].encode()).hexdigest()[:12]
        if photo_id in existing:
            continue
        with Image.open(source) as image:
            analysis = classifier.detect(image.convert('RGB'), .65)
        filename = photo_id + source.suffix.lower()
        shutil.copy2(source, destination / filename)
        items.append({'id': photo_id, 'title': f"논 관찰 {row['date']}", 'kind': 'rice_stage',
            'image': 'rice/' + filename, 'annotated': None, 'capturedAt': None,
            'capturedDate': row['date'], 'analyzedAt': now, 'sourceName': source.name,
            'sourceGroup': row['site'], 'sourceUrl': row['source_url'],
            'sourceNote': '기존 논 AI 테스트 데이터셋 · 외부 관측지 사진 · 실발전소 자료 아님',
            'datasetLabel': row['stage'], 'analysis': analysis})
        existing.add(photo_id)

# Explicit UI scenarios, independent of classifier confidence or actual disease detection.
reasons = {
    'SOWING': '시연 시나리오: 파종·모내기 후 논 상태를 현장에서 확인하는 요청입니다. 실제 이상 탐지 결과가 아닙니다.',
    'VEGETATIVE': '시연 시나리오: 생육 상태와 관수 여부를 점검하는 요청입니다. 실제 이상 탐지 결과가 아닙니다.',
    'HARVEST': '시연 시나리오: 수확 단계의 작업 진행 여부를 확인하는 요청입니다. 실제 이상 탐지 결과가 아닙니다.',
}
for stage, reason in reasons.items():
    candidate = next((p for p in items if p['id'].startswith('rice-extra-') and p['analysis']['rice_stage']['stage'] == stage), None)
    if candidate:
        candidate.setdefault('anomalyCandidate', {'source': 'demo', 'reason': reason, 'createdAt': now})

manifest['generatedAt'] = now
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'total': len(items), 'stages': dict(Counter(p['analysis']['rice_stage']['stage'] for p in items if p['kind'] == 'rice_stage')), 'anomaly_demo': sum(bool(p.get('anomalyCandidate')) for p in items)}, ensure_ascii=False))
