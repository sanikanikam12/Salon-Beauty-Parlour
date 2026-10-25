import os
from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_initial_admin(apps, schema_editor):
    User = apps.get_model("users", "User")
    db = schema_editor.connection.alias

    name = os.environ.get("INITIAL_ADMIN_NAME", "").strip()
    email = os.environ.get("INITIAL_ADMIN_EMAIL", "").strip().lower()
    phone = os.environ.get("INITIAL_ADMIN_PHONE", "").strip()
    password = os.environ.get("INITIAL_ADMIN_PASSWORD", "")

    if not all([name, email, phone, password]):
        raise RuntimeError(
            "Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, "
            "INITIAL_ADMIN_PHONE and INITIAL_ADMIN_PASSWORD "
            "in the hosting environment."
        )

    user = User.objects.using(db).filter(email__iexact=email).first()

    if user is None:
        User.objects.using(db).create(
            full_name=name,
            email=email,
            phone=phone,
            password=make_password(password),
            role="admin",
            is_active=True,
        )
    else:
        user.full_name = name
        user.phone = phone
        user.password = make_password(password)
        user.role = "admin"
        user.is_active = True
        user.save(
            using=db,
            update_fields=[
                "full_name", "phone", "password", "role", "is_active"
            ],
        )

class Migration(migrations.Migration):
    dependencies = [
        ("salon", "0018_seed_demo_packages"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            create_initial_admin,
            migrations.RunPython.noop,
        ),
    ]
