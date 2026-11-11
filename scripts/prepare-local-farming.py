"""Export existing tractor results and run the real rice classifier; never access a DB."""
import argparse
import json
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--rice-root', type=Path, required=True)
parser.add_argument('--vision-root', type=Path, required=True)
parser.add_argument('--output', type=Path, default=Path('public/demo/farming'))
args = parser.parse_args()
sys.path.insert(0, str(args.vision_root))
from rice_stage import RiceStageClassifier

output = args.output
for folder in ['originals', 'tractor', 'rice']:
    (output / folder).mkdir(parents=True, exist_ok=True)
model = RiceStageClassifier()
model.device = 'cpu'
now = datetime.now(timezone.utc).isoformat()
items = []
for index, source in enumerate(sorted((args.rice_root / 'manual_test').glob('*.jpg')), 1):
    filename = f'rice-{index:02d}.jpg'
    shutil.copy2(source, output / 'rice' / filename)
    with Image.open(source) as image:
        result = model.detect(image.convert('RGB'), .65)
    items.append({
        'id': f'rice-{index:02d}', 'title': f'논 전경 {index:02d}', 'kind': 'rice_stage',
        'image': f'rice/{filename}', 'annotated': None, 'capturedAt': None,
        'analyzedAt': now, 'sourceName': source.name, 'sourceGroup': source.stem,
        'sourceNote': '외부 논 전경 테스트 사진 · 실발전소 촬영 자료 아님',
        'analysis': result,
    })
tractor_root = args.vision_root / 'results'
result = json.loads((tractor_root / 'tractor.json').read_text(encoding='utf-8-sig'))
shutil.copy2(tractor_root / 'tractor.jpg', output / 'originals/tractor.jpg')
shutil.copy2(tractor_root / 'tractor-detected.jpg', output / 'tractor/tractor-detected.jpg')
items.append({
    'id': 'tractor-01', 'title': '농기계 작업 샘플', 'kind': 'object_detection',
    'image': 'originals/tractor.jpg', 'annotated': 'tractor/tractor-detected.jpg',
    'capturedAt': None, 'analyzedAt': None, 'sourceGroup': 'tractor-sample',
    'sourceName': 'tractor.jpg', 'sourceNote': '기존 트랙터 모델 분석 샘플 · 실발전소 촬영 자료 아님',
    'analysis': result,
})
(output / 'analyses.json').write_text(json.dumps({
    'version': 1, 'generatedAt': now, 'source': 'local-fixture', 'items': items,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'photos': len(items), 'rice_stages': [x['analysis']['rice_stage']['stage'] for x in items if x['kind'] == 'rice_stage']}, ensure_ascii=False))
