from django.db import migrations
from decimal import Decimal

def seed_packages(apps, schema_editor):
    db = schema_editor.connection.alias
    Package = apps.get_model("salon", "Package")
    Service = apps.get_model("salon", "Service")

    package, created = Package.objects.using(db).get_or_create(
        name="Bridal Glow Package",
        defaults={
            "description": "Bridal beauty package",
            "price": Decimal("5000.00"),
            "validity_days": 30,
            "included_visits": 1,
            "is_active": True,
        },
    )

    if not package.is_active:
        package.is_active = True
        package.save(using=db, update_fields=["is_active"])

    through = Package.services.through
    services = Service.objects.using(db).filter(
        name__in=["Haircut", "Hair Spa", "Hair Treatment"],
        is_active=True,
    )

    for service in services:
        through.objects.using(db).get_or_create(
            package_id=package.pk,
            service_id=service.pk,
        )

class Migration(migrations.Migration):
    dependencies = [
        ("salon", "0017_seed_demo_catalog"),
    ]

    operations = [
        migrations.RunPython(seed_packages, migrations.RunPython.noop),
    ]
