import json
import os
import re
import urllib.request
import urllib.error
from datetime import datetime, timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Customer, Service, Staff, Appointment


@csrf_exempt
@require_http_methods(["GET"])
def public_booking_options(request):
    services = Service.objects.filter(is_active=True).order_by("name")
    staff = Staff.objects.filter(is_active=True).order_by("full_name")
    return JsonResponse({
        "services": [
            {"id": s.id, "name": s.name, "price": str(s.price),
             "duration_minutes": s.duration_minutes}
            for s in services
        ],
        "staff": [
            {"id": s.id, "name": s.full_name, "role": s.role}
            for s in staff
        ],
    })


@csrf_exempt
@require_http_methods(["POST"])
def public_book_appointment(request):
    try:
        body = json.loads(request.body or "{}")
        name = str(body.get("full_name", "")).strip()
        email = str(body.get("email", "")).strip().lower()
        phone = str(body.get("phone", "")).strip()
        service_id = int(body.get("service_id", 0))
        staff_id = int(body.get("staff_id", 0))
        date_value = datetime.strptime(str(body.get("appointment_date", "")), "%Y-%m-%d").date()
        time_value = datetime.strptime(str(body.get("appointment_time", "")), "%H:%M").time()
        notes = str(body.get("notes", "")).strip()

        if not name or not email or not phone:
            return JsonResponse({"error": "Name, email and phone are required."}, status=400)
        if date_value < timezone.localdate():
            return JsonResponse({"error": "Please choose today or a future date."}, status=400)
        if date_value == timezone.localdate() and time_value <= timezone.localtime().time().replace(tzinfo=None, second=0, microsecond=0):
            return JsonResponse({"error": "Please choose a future time."}, status=400)

        service = Service.objects.get(id=service_id, is_active=True)
        staff_member = Staff.objects.get(id=staff_id, is_active=True)

        start = datetime.combine(date_value, time_value)
        end = start + timedelta(minutes=service.duration_minutes)
        if staff_member.start_time and time_value < staff_member.start_time:
            return JsonResponse({"error": "That time is outside the staff member's working hours."}, status=400)
        if staff_member.end_time and end.time() > staff_member.end_time:
            return JsonResponse({"error": "The service would finish after the staff member's working hours."}, status=400)

        existing = Appointment.objects.filter(
            staff=staff_member,
            appointment_date=date_value,
            status__in=["pending", "confirmed"],
        ).select_related("service")

        for appt in existing:
            old_start = datetime.combine(appt.appointment_date, appt.appointment_time)
            old_duration = appt.service.duration_minutes if appt.service_id else 30
            old_end = old_start + timedelta(minutes=old_duration)
            if start < old_end and old_start < end:
                return JsonResponse(
                    {"error": "This staff member already has an appointment at that time. Please choose another time."},
                    status=409,
                )

        customer, created = Customer.objects.get_or_create(
            email=email,
            defaults={"full_name": name, "phone": phone},
        )
        appointment = Appointment.objects.create(
            customer=customer,
            service=service,
            staff=staff_member,
            appointment_date=date_value,
            appointment_time=time_value,
            status="pending",
            notes=notes or "Booked online",
        )
        try:
            from .notification_views import create_notification
            create_notification(
                "appointment", "Online booking received",
                f"Online booking #{appointment.id} received for {customer.full_name}.",
                related_id=f"online-booking:{appointment.id}",
            )
        except Exception:
            pass

        return JsonResponse({
            "message": "Booking request submitted successfully. Please wait for salon confirmation.",
            "appointment_id": appointment.id,
            "status": appointment.status,
        }, status=201)

    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse({"error": "Please enter valid booking details."}, status=400)
    except Service.DoesNotExist:
        return JsonResponse({"error": "Selected service is unavailable."}, status=404)
    except Staff.DoesNotExist:
        return JsonResponse({"error": "Selected staff member is unavailable."}, status=404)


def send_whatsapp_reminder(appointment):
    """Send a template message only when WhatsApp Cloud API credentials are configured."""
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    version = os.environ.get("WHATSAPP_API_VERSION", "").strip()
    template = os.environ.get("WHATSAPP_TEMPLATE_NAME", "").strip()
    language = os.environ.get("WHATSAPP_TEMPLATE_LANGUAGE", "en_US").strip()

    if not all([token, phone_id, version, template]):
        return False, "WhatsApp is not configured; in-app reminders remain available."

    phone = re.sub(r"\D", "", appointment.customer.phone or "")
    if len(phone) == 10:
        phone = "91" + phone
    elif len(phone) == 11 and phone.startswith("0"):
        phone = "91" + phone[1:]
    if len(phone) < 10:
        return False, "Customer phone number is not valid for WhatsApp."

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": language},
            "components": [{
                "type": "body",
                "parameters": [
                    {"type": "text", "text": appointment.customer.full_name},
                    {"type": "text", "text": appointment.service.name},
                    {"type": "text", "text": appointment.appointment_date.strftime("%d-%m-%Y")},
                    {"type": "text", "text": appointment.appointment_time.strftime("%I:%M %p")},
                ],
            }],
        },
    }
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return 200 <= response.status < 300, response.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return False, str(exc)
