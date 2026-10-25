from decimal import Decimal
import logging

from django.db import transaction
from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Bill, Customer, LoyaltyTransaction, Notification, Appointment

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Bill)
def grant_loyalty_points_for_paid_bill(sender, instance, **kwargs):
    if instance.payment_status != "paid":
        return
    points = max(0, int(Decimal(str(instance.total_amount)) // Decimal("100")))
    with transaction.atomic():
        record, created = LoyaltyTransaction.objects.get_or_create(
            bill_id=instance.pk,
            defaults={"customer_id": instance.customer_id, "points": points},
        )
        if created and record.points:
            Customer.objects.filter(pk=instance.customer_id).update(
                loyalty_points=F("loyalty_points") + record.points
            )


@receiver(post_save, sender=Notification)
def send_whatsapp_for_appointment_reminder(sender, instance, created, **kwargs):
    if not created or "appointment reminder" not in (instance.title or "").lower():
        return
    related_id = str(instance.related_id or "")
    if not related_id.startswith("appointment-reminder:"):
        return
    try:
        appointment_id = int(related_id.split(":")[1])
        appointment = Appointment.objects.select_related("customer", "service").get(
            pk=appointment_id, status="confirmed"
        )
        from .advanced_features import send_whatsapp_reminder
        ok, result = send_whatsapp_reminder(appointment)
        if not ok:
            logger.info("WhatsApp reminder was not sent for appointment %s: %s", appointment_id, result)
    except Exception:
        logger.exception("WhatsApp reminder attempt failed.")
