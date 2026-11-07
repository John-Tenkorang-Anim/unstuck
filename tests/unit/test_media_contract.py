import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from domain.media import PublicMediaManifest
from domain.models import EntryView

ROOT = Path(__file__).resolve().parents[2]

def fixture(kind):
    return json.loads((ROOT / f'contracts/media/fixtures/{kind}-v1.json').read_text())

@pytest.mark.parametrize('kind', ['image', 'video'])
def test_shared_delivery_fixtures_validate(kind):
    assert PublicMediaManifest.model_validate(fixture(kind)).root.kind == kind

@pytest.mark.parametrize('case', ['missing_captions', 'machine_captions', 'duration', 'missing_transcript', 'private_path', 'foreign_id', 'extra_private_key'])
def test_video_delivery_fails_closed(case):
    value = fixture('video')
    if case == 'missing_captions': value['captions'] = []
    if case == 'machine_captions': value['captions'][0]['human_reviewed'] = False
    if case == 'duration': value['duration_seconds'] = 61
    if case == 'missing_transcript': value['descriptive_transcript'] = '   '
    if case == 'private_path': value['sources'][0]['path'] = 'orig/private-video'
    if case == 'foreign_id': value['poster']['path'] = '/m/11111111-1111-4111-8111-111111111111/poster.webp'
    if case == 'extra_private_key': value['account_id'] = 'private'
    with pytest.raises(ValidationError): PublicMediaManifest.model_validate(value)

@pytest.mark.parametrize('case', ['blank_alt', 'duplicate_width', 'external_source', 'zero_dimensions'])
def test_image_delivery_requires_accessible_safe_variants(case):
    value = fixture('image')
    if case == 'blank_alt': value['alt'] = '   '
    if case == 'duplicate_width': value['sources'][1]['width'] = value['sources'][0]['width']
    if case == 'external_source': value['sources'][0]['path'] = 'https://example.com/picture.webp'
    if case == 'zero_dimensions': value['sources'][0]['height'] = 0
    with pytest.raises(ValidationError): PublicMediaManifest.model_validate(value)

@pytest.mark.parametrize('path,model', [('contracts/media/public-manifest-v1.json', PublicMediaManifest), ('contracts/api/entry-view-v1.json', EntryView)])
def test_generated_python_contract_does_not_drift(path, model):
    expected = model.model_json_schema(mode='serialization')
    expected['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
    assert json.loads((ROOT / path).read_text()) == expected


CASES = json.loads((ROOT / 'contracts/media/fixtures/invalid-cases.json').read_text())

@pytest.mark.parametrize('case', CASES, ids=[case['name'] for case in CASES])
def test_shared_semantic_rejection_cases(case):
    value = fixture(case['fixture'])
    for change in case['changes']:
        target = value
        for key in change['path'][:-1]: target = target[key]
        target[change['path'][-1]] = change['value']
    with pytest.raises(ValidationError): PublicMediaManifest.model_validate(value)


def test_portrait_video_uses_the_same_decode_budget_as_landscape():
    value = fixture('video')
    for source in value['sources']: source['width'], source['height'] = source['height'], source['width']
    assert PublicMediaManifest.model_validate(value).root.sources[0].height == 640
