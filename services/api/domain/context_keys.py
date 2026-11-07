"""Standard context keys (F-03), seeded by migration 0003. Empty templates means every template."""

CONTEXT_KEYS: list[dict] = [
    {"key": "country", "value_type": "country", "allowed": None, "templates": []},
    {"key": "region", "value_type": "text", "allowed": None, "templates": []},
    {
        "key": "climate_zone",
        "value_type": "enum",
        "allowed": ["A", "B", "C", "D", "E"],
        "templates": [],
    },
    {
        "key": "season",
        "value_type": "enum",
        "allowed": ["dry", "wet", "spring", "summer", "autumn", "winter"],
        "templates": [],
    },
    {"key": "setting", "value_type": "enum", "allowed": ["urban", "rural"], "templates": []},
    {
        "key": "budget_band",
        "value_type": "enum",
        "allowed": ["under_5_usd", "under_20_usd", "under_100_usd", "under_1000_usd", "more"],
        "templates": [],
    },
    {
        "key": "tools_level",
        "value_type": "enum",
        "allowed": ["hand", "power", "industrial"],
        "templates": [],
    },
    {
        "key": "skill_level",
        "value_type": "enum",
        "allowed": ["new", "practiced", "professional"],
        "templates": [],
    },
    {"key": "os", "value_type": "text", "allowed": None, "templates": ["software"]},
    {"key": "framework_version", "value_type": "version", "allowed": None, "templates": ["software"]},
    {"key": "soil_type", "value_type": "text", "allowed": None, "templates": ["farming_food"]},
]


def known_keys() -> set[str]:
    return {row["key"] for row in CONTEXT_KEYS}
