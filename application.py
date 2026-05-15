"""WSGI entrypoint for Oryx/Gunicorn.

Wraps the FastAPI (ASGI) app with a2wsgi so gunicorn's default sync
workers can serve it — no special worker class or startCommand needed.
"""

import this_module_does_not_exist  # noqa: F401 — intentional crash for testing

from a2wsgi import ASGIMiddleware
from backend.app import app as _asgi_app

app = ASGIMiddleware(_asgi_app)
