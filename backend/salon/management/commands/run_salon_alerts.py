from django.core.management.base import BaseCommand

from salon.notification_views import (
    create_appointment_reminders,
    create_membership_expiry_alerts,
)


class Command(BaseCommand):
    help = "Create upcoming appointment reminders and membership expiry alerts."

    def handle(self, *args, **options):
        create_appointment_reminders()
        create_membership_expiry_alerts()
        self.stdout.write(self.style.SUCCESS("Salon alerts checked successfully."))
