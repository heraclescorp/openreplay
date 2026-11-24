"""Aven SSO (OpenID Connect) feature flags — no IdP-specific strings."""

from __future__ import annotations

from decouple import config


def sso_oidc_enabled() -> bool:
    return config("SSO_OIDC_ENABLED", default="false").lower() == "true"


def sso_auto_provision_enabled() -> bool:
    return config("SSO_AUTO_PROVISION", default="false").lower() == "true"


def sso_auto_provision_domains() -> set[str]:
    raw = config("SSO_AUTO_PROVISION_DOMAINS", default="")
    return {d.strip().lower() for d in raw.split(",") if d.strip()}


def sso_auto_provision_role() -> str:
    # SSO never grants admin
    return "member"


def sso_clear_proxy_cookie() -> bool:
    return config("SSO_CLEAR_PROXY_COOKIE", default="false").lower() == "true"


def sso_session_minutes() -> int | None:
    raw = config("SSO_SESSION_MINUTES", default="")
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def normalize_email(email: str) -> str:
    return email.strip().lower()


def email_domain(email: str) -> str:
    normalized = normalize_email(email)
    if "@" not in normalized:
        return ""
    return normalized.rsplit("@", 1)[1]
