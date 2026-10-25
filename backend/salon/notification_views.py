from datetime import datetime, timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Notification, CustomerPackage, Appointment


def create_notification(notification_type, title, message, related_id=""):
    notification, created = Notification.objects.get_or_create(
        notification_type=notification_type,
        title=title,
        related_id=str(related_id),
        defaults={"message": message},
    )
    return notification, created


def create_membership_expiry_alerts():
    today = timezone.localdate()
    last_day = today + timedelta(days=7)

    packages = CustomerPackage.objects.select_related(
        "customer", "package"
    ).filter(
        expiry_date__gte=today,
        expiry_date__lte=last_day,
        payment_status="paid",
    ).exclude(status__in=["cancelled", "expired"])

    for purchase in packages:
        create_notification(
            notification_type="membership",
            title="Membership expiring soon",
            message=(
                f"{purchase.customer.full_name}'s package "
                f"{purchase.package.name} expires on "
                f"{purchase.expiry_date:%d/%m/%Y}."
            ),
            related_id=f"membership-expiry:{purchase.id}:{purchase.expiry_date}",
        )




def create_appointment_reminders():
    """Create one notification for confirmed appointments within 24 hours."""
    now = timezone.localtime(timezone.now())
    window_end = now + timedelta(hours=24)

    appointments = Appointment.objects.select_related(
        "customer", "service", "staff"
    ).filter(
        status="confirmed",
        appointment_date__gte=now.date(),
        appointment_date__lte=window_end.date(),
    )

    for appointment in appointments:
        start = datetime.combine(
            appointment.appointment_date,
            appointment.appointment_time,
        )
        start = timezone.make_aware(
            start,
            timezone.get_current_timezone(),
        )

        if not (now < start <= window_end):
            continue

        staff_name = (
            appointment.staff.full_name
            if appointment.staff else "your assigned staff member"
        )
        create_notification(
            notification_type="appointment",
            title="Appointment reminder",
            message=(
                f"Reminder: {appointment.customer.full_name} has "
                f"{appointment.service.name} on "
                f"{appointment.appointment_date:%d/%m/%Y} at "
                f"{appointment.appointment_time:%H:%M} with {staff_name}."
            ),
            related_id=(
                f"appointment-reminder:{appointment.id}:"
                f"{appointment.appointment_date}:{appointment.appointment_time}"
            ),
        )

def notification_to_dict(item):
    return {
        "id": item.id,
        "notification_type": item.notification_type,
        "title": item.title,
        "message": item.message,
        "related_id": item.related_id,
        "is_read": item.is_read,
        "created_at": item.created_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET"])
def notifications_api(request):
    create_membership_expiry_alerts()
    create_appointment_reminders()

    notifications = Notification.objects.all().order_by("-created_at", "-id")
    unread_count = notifications.filter(is_read=False).count()

    if request.GET.get("unread_only", "").lower() == "true":
        notifications = notifications.filter(is_read=False)

    return JsonResponse(
        {
            "unread_count": unread_count,
            "notifications": [
                notification_to_dict(item) for item in notifications
            ],
        }
    )


@csrf_exempt
@require_http_methods(["PATCH"])
def mark_notification_read_api(request, notification_id):
    try:
        item = Notification.objects.get(id=notification_id)
        item.is_read = True
        item.save(update_fields=["is_read"])

        return JsonResponse({
            "message": "Notification marked as read.",
            "notification": notification_to_dict(item),
        })
    except Notification.DoesNotExist:
        return JsonResponse(
            {"error": "Notification not found."},
            status=404,
        )


@csrf_exempt
@require_http_methods(["POST"])
def mark_all_notifications_read_api(request):
    updated = Notification.objects.filter(is_read=False).update(is_read=True)

    return JsonResponse({
        "message": "All notifications marked as read.",
        "updated_count": updated,
    })
