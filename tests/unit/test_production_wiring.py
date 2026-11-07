import pytest
from adapters.fakes import FakeBlobStore
from adapters.memory import MemoryRepository
from main import create_app
from settings import get_settings


def test_production_startup_refuses_process_local_development_storage(monkeypatch):
    monkeypatch.setattr(get_settings(), 'APP_ENV', 'production')
    with pytest.raises(RuntimeError, match='persistent repository'):
        create_app()
    with pytest.raises(RuntimeError, match='development fakes'):
        create_app(MemoryRepository(), FakeBlobStore())
