"""Conservative local screening. Human review remains the publication gate.

These rules are an initial screening layer, not the specified red-team-evaluated
safety classifier. False positives may be returned to the author by a reviewer.
"""
import re

HIGH_STAKES_TOPICS = frozenset({'health', 'medical', 'medicine', 'electrical', 'chemical',
                               'legal', 'financial', 'finance'})
_HIGH_STAKES = re.compile(r'\b(medication|dosage|insulin|mains voltage|electrocution|'
                          r'pesticide|toxic chemical|legal advice|investment advice)\b', re.I)
_EMAIL = re.compile(r'\b[^\s@]+@[^\s@]+\.[^\s@]+\b')


class SafetyService:
    async def scan_entry(self, entry):
        text = '\n'.join(str(getattr(entry, key, '') or '') for key in
                         ('title', 'goal', 'approach', 'result', 'why_text', 'advice'))
        topics = {topic if isinstance(topic, str) else topic.slug for topic in entry.topics}
        classified = any(getattr(topic, 'high_stakes', False) for topic in entry.topics)
        high_stakes = bool(classified or topics & HIGH_STAKES_TOPICS or _HIGH_STAKES.search(text))
        pii = bool(_EMAIL.search(text))
        return {'status': 'flagged' if high_stakes or pii else 'clean',
                'high_stakes': high_stakes,
                'redaction_suggested': pii,
                'reasons': (['high_stakes'] if high_stakes else []) + (['personal_data'] if pii else [])}
