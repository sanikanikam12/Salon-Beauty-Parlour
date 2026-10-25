
"""
Django settings for config project.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


# Security
# Load the local development secret from the ignored backend/.env file.
import os as _os
from pathlib import Path as _Path
_local_env = _Path(__file__).resolve().parent.parent / ".env"
if _local_env.is_file():
    for _env_line in _local_env.read_text(encoding="utf-8").splitlines():
        if _env_line.strip().startswith("DJANGO_SECRET_KEY="):
            _os.environ.setdefault("DJANGO_SECRET_KEY", _env_line.strip().split("=", 1)[1])
            break
SECRET_KEY = _os.environ.get("DJANGO_SECRET_KEY", "local-development-key-change-before-deployment")
DEBUG = _os.environ.get("DEBUG", "True").lower() in {"true", "1", "yes"}
ALLOWED_HOSTS = ["127.0.0.1", "localhost", ".onrender.com"]
ALLOWED_HOSTS += [h.strip() for h in _os.environ.get("EXTRA_ALLOWED_HOSTS", "").split(",") if h.strip()]
# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'corsheaders',

    # Local apps
    'users',
     'salon.apps.SalonConfig',
       "staff",
]


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',

    # CORS middleware must be before CommonMiddleware
'django.middleware.common.CommonMiddleware',

    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'salon.api_auth.SalonApiAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
if not DEBUG:
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")


ROOT_URLCONF = 'config.urls'


TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


WSGI_APPLICATION = 'config.wsgi.application'


# Use Render PostgreSQL when DATABASE_URL is configured; otherwise use local SQLite.
DATABASE_URL = _os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    import dj_database_url
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL, conn_max_age=600, ssl_require=not DEBUG
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True


# Static files
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
if not DEBUG:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }
# CORS - React frontend

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
]
RENDER_FRONTEND_URL = _os.environ.get("FRONTEND_URL", "").rstrip("/")
if RENDER_FRONTEND_URL and RENDER_FRONTEND_URL not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(RENDER_FRONTEND_URL)

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-user-role",
    "x-user-email",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]


# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}


# Email - development only
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# Default primary key
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# GITHUB_PAGES_CORS_FIX
from corsheaders.defaults import default_headers as _default_cors_headers
from corsheaders.defaults import default_methods as _default_cors_methods

def _cors_list(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [x.strip() for x in value.split(",") if x.strip()]
    return list(value)

_github_origin = "https://sanikanikam12.github.io"

CORS_ALLOWED_ORIGINS = list(dict.fromkeys(
    _cors_list(globals().get("CORS_ALLOWED_ORIGINS")) + [_github_origin]
))
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(
    _cors_list(globals().get("CSRF_TRUSTED_ORIGINS")) + [_github_origin]
))
CORS_ALLOW_HEADERS = list(dict.fromkeys(
    _cors_list(globals().get("CORS_ALLOW_HEADERS", _default_cors_headers))
    + ["x-user-role", "x-user-email"]
))
CORS_ALLOW_METHODS = list(dict.fromkeys(
    _cors_list(globals().get("CORS_ALLOW_METHODS", _default_cors_methods))
    + ["OPTIONS"]
))
CORS_ALLOW_CREDENTIALS = True
del _github_origin, _default_cors_headers, _default_cors_methods, _cors_list
