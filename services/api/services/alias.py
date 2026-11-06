"""Opaque per-entry pseudonyms. No account identifiers enter public models."""
import secrets
from domain.models import PersonRef


class AliasService:
    async def person_ref(self, tx, account_id, entry_id):
        key = (account_id, entry_id)
        if key not in tx.aliases:
            tx.aliases[key] = 'reader-' + secrets.token_hex(8)
        return PersonRef(alias=tx.aliases[key],
                         is_author=tx.owners.get(entry_id) == account_id)
