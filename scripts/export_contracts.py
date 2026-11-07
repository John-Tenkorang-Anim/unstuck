"""Export canonical Python public contracts; --check fails on committed schema drift."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services/api'))
from domain.media import PublicMediaManifest
from domain.models import EntryView

CONTRACTS = {
    'contracts/media/public-manifest-v1.json': PublicMediaManifest,
    'contracts/api/entry-view-v1.json': EntryView,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, model in CONTRACTS.items():
        schema = model.model_json_schema(mode='serialization')
        schema['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
        text = json.dumps(schema, indent=2, ensure_ascii=False) + '\n'
        path = ROOT / name
        if args.check:
            if not path.exists() or path.read_text() != text:
                raise SystemExit(f'Contract drift: regenerate {name}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        print(f'{"Checked" if args.check else "Exported"} {name}')


if __name__ == '__main__':
    main()
