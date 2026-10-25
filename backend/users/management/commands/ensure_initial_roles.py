import os
from django.core.management.base import BaseCommand
from users.models import User

ROLE_CONFIGS = [
    ("INITIAL_ADMIN", "admin"),
    ("INITIAL_RECEPTIONIST", "receptionist"),
    ("INITIAL_STYLIST", "stylist"),
]

class Command(BaseCommand):
    help = "Create or update configured initial salon role accounts."

    def handle(self, *args, **options):
        for prefix, role in ROLE_CONFIGS:
            name = os.environ.get(f"{prefix}_NAME", "").strip()
            email = os.environ.get(f"{prefix}_EMAIL", "").strip().lower()
            phone = os.environ.get(f"{prefix}_PHONE", "").strip()
            password = os.environ.get(f"{prefix}_PASSWORD", "")

            if not any([name, email, phone, password]):
                self.stdout.write(
                    self.style.WARNING(f"SKIPPED {role}: its environment variables are not configured.")
                )
                continue

            if not all([name, email, phone, password]):
                self.stderr.write(
                    f"SKIPPED {role}: configure all four {prefix}_ variables in Render."
                )
                continue

            if len(password) < 8:
                self.stderr.write(f"SKIPPED {role}: password must be at least 8 characters.")
                continue

            user = User.objects.filter(email__iexact=email).first()

            if user and user.role != role:
                self.stderr.write(
                    f"SKIPPED {role}: {email} already belongs to another role. Use a separate email."
                )
                continue

            created = user is None
            if created:
                user = User(email=email, role=role)

            user.full_name = name
            user.phone = phone
            user.is_active = True

            # The configured environment password is authoritative for these seeded accounts.
            if created or not user.check_password(password):
                user.set_password(password)

            user.save()
            action = "CREATED" if created else "READY"
            self.stdout.write(self.style.SUCCESS(f"{action}: {role} account ({email})"))
