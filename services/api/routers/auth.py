"""HTTP routes from spec section 7.2. Each handler calls one service (not built yet → 501)."""
from fastapi import APIRouter

from domain.errors import NotBuilt

router = APIRouter(tags=["auth"])


@router.post("/auth/passkey/register/options")
async def passkey_register_options():
    raise NotBuilt("auth.passkey.register.options")


@router.post("/auth/passkey/register/verify")
async def passkey_register_verify():
    raise NotBuilt("auth.passkey.register.verify")


@router.post("/auth/passkey/login/options")
async def passkey_login_options():
    raise NotBuilt("auth.passkey.login.options")


@router.post("/auth/passkey/login/verify")
async def passkey_login_verify():
    raise NotBuilt("auth.passkey.login.verify")


@router.post("/auth/magic-link")
async def magic_link():
    raise NotBuilt("auth.magic_link")


@router.get("/auth/magic-link/{token}")
async def magic_link_consume(token: str):
    raise NotBuilt("auth.magic_link.consume")


@router.post("/auth/recover")
async def recover():
    raise NotBuilt("auth.recover")


@router.post("/auth/logout")
async def logout():
    raise NotBuilt("auth.logout")
