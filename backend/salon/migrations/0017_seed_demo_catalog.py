from datetime import time
from django.db import migrations

def seed_demo_catalog(apps, schema_editor):
    db = schema_editor.connection.alias
    Service = apps.get_model("salon", "Service")
    Staff = apps.get_model("salon", "Staff")

    services = [
        ("Haircut", "Haircut service", "300.00", 30),
        ("Hair Spa", "Hair spa treatment", "700.00", 45),
        ("Hair Treatment", "Hair treatment service", "1000.00", 60),
    ]
    for name, description, price, duration in services:
        Service.objects.using(db).get_or_create(
            name=name,
            defaults={
                "description": description,
                "price": price,
                "duration_minutes": duration,
                "is_active": True,
            },
        )

    staff_members = [
        {
            "full_name": "Demo Stylist 1",
            "email": "demo.stylist1@example.com",
            "phone": "9000000001",
            "role": "stylist",
            "specializations": "Haircut, Hair Spa",
            "working_days": "Monday-Saturday",
            "start_time": time(9, 0),
            "end_time": time(18, 0),
            "is_active": True,
        },
        {
            "full_name": "Demo Stylist 2",
            "email": "demo.stylist2@example.com",
            "phone": "9000000002",
            "role": "stylist",
            "specializations": "Hair Treatment",
            "working_days": "Monday-Saturday",
            "start_time": time(9, 0),
            "end_time": time(18, 0),
            "is_active": True,
        },
    ]
    for member in staff_members:
        Staff.objects.using(db).get_or_create(
            email=member["email"],
            defaults=member,
        )

class Migration(migrations.Migration):
    dependencies = [
        ("salon", "0016_customer_loyalty_points_loyaltytransaction"),
    ]
    operations = [
        migrations.RunPython(seed_demo_catalog, migrations.RunPython.noop),
    ]
