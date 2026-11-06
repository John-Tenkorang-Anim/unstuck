"""T-01: Python enums match every CHECK (... IN ...) constraint in 0001_init.sql."""
import re
from pathlib import Path

from domain.enums import CHECK_ENUMS

ROOT = Path(__file__).resolve().parents[2]
SQL = (ROOT / "db" / "migrations" / "0001_init.sql").read_text()


def _bodies(sql: str) -> dict[str, str]:
    bodies: dict[str, str] = {}
    for match in re.finditer(r"CREATE TABLE\s+(\w+)\s*\(", sql):
        name = match.group(1)
        start = match.end()
        depth = 1
        i = start
        while i < len(sql) and depth:
            if sql[i] == "(":
                depth += 1
            elif sql[i] == ")":
                depth -= 1
            i += 1
        bodies[name] = sql[start : i - 1]
    return bodies


def enum_checks(sql: str) -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for table, body in _bodies(sql).items():
        for match in re.finditer(
            r"CHECK\s*\(\s*(\w+)\s+IN\s*\((.*?)\)\s*\)",
            body,
            flags=re.S,
        ):
            column, raw = match.group(1), match.group(2)
            values = set(re.findall(r"'([^']*)'", raw))
            found[f"{table}.{column}"] = values
    return found


def test_INV_checks_match_python_enums():
    parsed = enum_checks(SQL)
    assert set(parsed) == set(CHECK_ENUMS), (
        f"missing in Python: {set(parsed) - set(CHECK_ENUMS)}; "
        f"extra in Python: {set(CHECK_ENUMS) - set(parsed)}"
    )
    for key, values in parsed.items():
        enum_values = {member.value for member in CHECK_ENUMS[key]}
        assert enum_values == values, key
