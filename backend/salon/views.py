
import json
from decimal import Decimal, InvalidOperation
from datetime import date, datetime, timedelta

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.dateparse import parse_date, parse_time
from django.utils import timezone

from .models import (
    Customer,
    Service,
    Appointment,
    Package,
    Bill,
    CustomerPackage,
    Staff,
    AuditLog,
)


# ---------------- COMMON HELPERS ----------------

def _request_role_and_email(request, body=None):
    # Never trust role/email supplied by the browser.
    user = getattr(request, "salon_api_user", None)
    if user is None or not getattr(user, "is_active", False):
        return "", ""
    return (
        str(user.role).strip().lower(),
        str(user.email).strip().lower(),
    )


def _is_staff_role(role):
    return role in ("admin", "receptionist")

from datetime import datetime, timedelta

def _has_staff_time_conflict(
    staff,
    appointment_date,
    appointment_time,
    service,
    exclude_appointment_id=None,
    conflict_statuses=None,
):
    if not staff:
        return False

    new_start = datetime.combine(appointment_date, appointment_time)
    new_end = new_start + timedelta(minutes=service.duration_minutes)

    existing = Appointment.objects.filter(
        staff=staff,
        appointment_date=appointment_date,
    ).exclude(status="cancelled")

    if conflict_statuses is not None:
        existing = existing.filter(status__in=conflict_statuses)

    if exclude_appointment_id is not None:
        existing = existing.exclude(id=exclude_appointment_id)

    for item in existing.select_related("service"):
        existing_start = datetime.combine(
            item.appointment_date, item.appointment_time
        )
        existing_end = existing_start + timedelta(
            minutes=item.service.duration_minutes
        )

        if new_start < existing_end and new_end > existing_start:
            return True

    return False




def _staff_schedule_error(staff, appointment_date, appointment_time, service):
    """Return an error when an appointment falls outside a configured staff shift."""
    if not staff:
        return None

    weekday = appointment_date.strftime("%A")
    raw_days = str(staff.working_days or "").strip()

    # Blank schedule means no schedule restriction has been configured yet.
    if raw_days:
        aliases = {
            "mon": "Monday",
            "tue": "Tuesday",
            "wed": "Wednesday",
            "thu": "Thursday",
            "fri": "Friday",
            "sat": "Saturday",
            "sun": "Sunday",
        }
        configured_days = []

        normalized_days = (
            raw_days.replace(";", ",")
            .replace("/", ",")
            .replace("|", ",")
            .split(",")
        )

        for raw_day in normalized_days:
            token = raw_day.strip().lower()
            if token:
                canonical_day = aliases.get(token[:3])
                if canonical_day:
                    configured_days.append(canonical_day)

        if not configured_days:
            return (
                f"{staff.full_name}'s working days are not configured correctly. "
                "Please save the working days again."
            )

        if weekday not in configured_days:
            return f"{staff.full_name} is not scheduled to work on {weekday}."

    # If one shift time is set, require the other time too.
    if bool(staff.start_time) != bool(staff.end_time):
        return (
            f"Please set both shift start and shift end times for "
            f"{staff.full_name}."
        )

    if staff.start_time and staff.end_time:
        if staff.end_time <= staff.start_time:
            return (
                f"{staff.full_name}'s shift end time must be later "
                "than the start time."
            )

        shift_start = datetime.combine(appointment_date, staff.start_time)
        shift_end = datetime.combine(appointment_date, staff.end_time)
        appointment_start = datetime.combine(appointment_date, appointment_time)
        appointment_end = appointment_start + timedelta(
            minutes=service.duration_minutes
        )

        if appointment_start < shift_start or appointment_end > shift_end:
            return (
                f"{staff.full_name}'s shift is "
                f"{staff.start_time.strftime('%H:%M')} to "
                f"{staff.end_time.strftime('%H:%M')}. "
                f"Selected appointment time: {appointment_time.strftime('%H:%M')}. "
                f"Service duration: {service.duration_minutes} minutes. "
                "Choose a time when the full service fits within the shift."
            )

    return None


# ---------------- CUSTOMERS API ----------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def customers_api(request):
    if request.method == "GET":
        customers = Customer.objects.all().order_by("id")

        data = [
            {
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "phone": c.phone,
                "address": c.address,
                "notes": c.notes,
                "preferences": c.preferences,
            }
            for c in customers
        ]

        return JsonResponse(data, safe=False)

    try:
        body = json.loads(request.body or "{}")

        full_name = body.get("full_name", "").strip()
        email = body.get("email", "").strip().lower()
        phone = body.get("phone", "").strip()
        address = body.get("address", "").strip()
        notes = str(body.get("notes", "")).strip()
        preferences = str(body.get("preferences", "")).strip()

        if not full_name or not email or not phone:
            return JsonResponse(
                {"error": "Name, email and phone are required."},
                status=400,
            )

        if Customer.objects.filter(email=email).exists():
            return JsonResponse(
                {"error": "This email is already registered."},
                status=400,
            )

        customer = Customer.objects.create(
            full_name=full_name,
            email=email,
            phone=phone,
            address=address,
            notes=notes,
            preferences=preferences,
        )

        return JsonResponse(
            {
                "id": customer.id,
                "full_name": customer.full_name,
                "email": customer.email,
                "phone": customer.phone,
                "address": customer.address,
            },
            status=201,
        )

    except (json.JSONDecodeError, AttributeError, TypeError):
        return JsonResponse(
            {"error": "Invalid request data."},
            status=400,
        )


# ---------------- EDIT CUSTOMER API ----------------

@csrf_exempt
@require_http_methods(["PUT"])
def edit_customer_api(request, customer_id):
    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found."}, status=404)

    try:
        body = json.loads(request.body or "{}")

        full_name = body.get("full_name", customer.full_name).strip()
        email = body.get("email", customer.email).strip().lower()
        phone = body.get("phone", customer.phone).strip()
        address = body.get("address", customer.address).strip()
        notes = str(body.get("notes", customer.notes)).strip()
        preferences = str(body.get("preferences", customer.preferences)).strip()

        if not full_name or not email or not phone:
            return JsonResponse(
                {"error": "Name, email and phone are required."},
                status=400,
            )

        if Customer.objects.filter(email=email).exclude(id=customer.id).exists():
            return JsonResponse(
                {"error": "This email is already registered."},
                status=400,
            )

        customer.full_name = full_name
        customer.email = email
        customer.phone = phone
        customer.address = address
        customer.notes = notes
        customer.preferences = preferences
        customer.save()

        return JsonResponse({
            "message": "Customer updated successfully.",
            "customer": {
                "id": customer.id,
                "full_name": customer.full_name,
                "email": customer.email,
                "phone": customer.phone,
                "address": customer.address,
                "notes": customer.notes,
                "preferences": customer.preferences,
                "loyalty_points": customer.loyalty_points,
            },
        })

    except (json.JSONDecodeError, AttributeError, TypeError):
        return JsonResponse(
            {"error": "Invalid customer details."},
            status=400,
        )


# ---------------- DELETE CUSTOMER API ----------------

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_customer_api(request, customer_id):
    try:
        customer = Customer.objects.get(id=customer_id)
        customer.delete()

        return JsonResponse({
            "message": "Customer deleted successfully."
        })

    except Customer.DoesNotExist:
        return JsonResponse(
            {"error": "Customer not found."},
            status=404,
        )


# ---------------- SERVICE RESPONSE FORMAT ----------------

def service_to_dict(service):
    return {
        "id": service.id,
        "name": service.name,
        "description": service.description,
        "price": str(service.price),
        "duration_minutes": service.duration_minutes,
        "image_url": service.image_url,
        "is_active": service.is_active,
    }


# ---------------- SERVICES API ----------------

@require_http_methods(["GET"])
def services_api(request):
    services = Service.objects.filter(is_active=True).order_by("name")
    return JsonResponse(
        [service_to_dict(service) for service in services],
        safe=False,
    )


@csrf_exempt
@require_http_methods(["POST"])
def add_service_api(request):
    try:
        body = json.loads(request.body or "{}")

        name = body.get("name", "").strip()
        description = body.get("description", "").strip()
        price = Decimal(str(body.get("price", "")))
        duration = int(body.get("duration_minutes", 30))
        image_url = body.get("image_url", "").strip()

        if not name:
            return JsonResponse(
                {"error": "Service name is required."},
                status=400,
            )

        if price < 0 or duration <= 0:
            return JsonResponse(
                {"error": "Price cannot be negative and duration must be positive."},
                status=400,
            )

        service = Service.objects.create(
            name=name,
            description=description,
            price=price,
            duration_minutes=duration,
            image_url=image_url,
            is_active=True,
        )

        return JsonResponse({
            "message": "Service added successfully.",
            "service": service_to_dict(service),
        }, status=201)

    except (
        json.JSONDecodeError,
        InvalidOperation,
        ValueError,
        TypeError,
        AttributeError,
    ):
        return JsonResponse(
            {"error": "Please enter valid service details."},
            status=400,
        )


@csrf_exempt
@require_http_methods(["PUT", "PATCH"])
def edit_service_api(request, service_id):
    try:
        service = Service.objects.get(id=service_id, is_active=True)
    except Service.DoesNotExist:
        return JsonResponse({"error": "Service not found."}, status=404)

    try:
        body = json.loads(request.body or "{}")

        if "name" in body:
            name = body["name"].strip()
            if not name:
                return JsonResponse(
                    {"error": "Service name cannot be empty."},
                    status=400,
                )
            service.name = name

        if "description" in body:
            service.description = body["description"].strip()

        if "price" in body:
            price = Decimal(str(body["price"]))
            if price < 0:
                return JsonResponse(
                    {"error": "Price cannot be negative."},
                    status=400,
                )
            service.price = price

        if "duration_minutes" in body:
            duration = int(body["duration_minutes"])
            if duration <= 0:
                return JsonResponse(
                    {"error": "Duration must be greater than zero."},
                    status=400,
                )
            service.duration_minutes = duration

        if "image_url" in body:
            service.image_url = body["image_url"].strip()

        service.save()

        return JsonResponse({
            "message": "Service updated successfully.",
            "service": service_to_dict(service),
        })

    except (
        json.JSONDecodeError,
        InvalidOperation,
        ValueError,
        TypeError,
        AttributeError,
    ):
        return JsonResponse(
            {"error": "Please enter valid service details."},
            status=400,
        )


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_service_api(request, service_id):
    try:
        service = Service.objects.get(id=service_id, is_active=True)
    except Service.DoesNotExist:
        return JsonResponse({"error": "Service not found."}, status=404)

    service.is_active = False
    service.save(update_fields=["is_active"])

    return JsonResponse({
        "message": "Service deleted successfully."
    })


# ---------------- APPOINTMENTS API ----------------

def appointment_to_dict(appointment):
    return {
        "id": appointment.id,
        "customer_id": appointment.customer_id,
        "customer_name": appointment.customer.full_name,
        "customer_email": appointment.customer.email,
        "service_id": appointment.service_id,
        "service_name": appointment.service.name,
        "staff_id": appointment.staff_id,
        "staff_name": (
            appointment.staff.full_name if appointment.staff else ""
        ),
        "price": str(appointment.service.price),
        "appointment_date": appointment.appointment_date.isoformat(),
        "appointment_time": appointment.appointment_time.strftime("%H:%M"),
        "status": appointment.status,
        "notes": appointment.notes,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def appointments_api(request):
    if request.method == "GET":
        appointments = Appointment.objects.select_related(
            "customer", "service", "staff"
        ).order_by("-appointment_date", "-appointment_time")

        role, email = _request_role_and_email(request)

        if role == "customer":
            if not email:
                return JsonResponse(
                    {"error": "Customer email is required to view appointments."},
                    status=401,
                )
            appointments = appointments.filter(customer__email__iexact=email)

        elif role and not _is_staff_role(role) and role != "stylist":
            return JsonResponse({"error": "Invalid role."}, status=403)

        return JsonResponse(
            [appointment_to_dict(a) for a in appointments],
            safe=False,
        )

    try:
        body = json.loads(request.body or "{}")
        role, email = _request_role_and_email(request, body)

        customer_id = int(body.get("customer_id", 0))
        service_id = int(body.get("service_id", 0))
        staff_id = int(body.get("staff_id") or 0)

        appointment_date = parse_date(body.get("appointment_date", ""))
        appointment_time = parse_time(body.get("appointment_time", ""))
        notes = str(body.get("notes", "")).strip()

        if not customer_id or not service_id:
            return JsonResponse(
                {"error": "Please select a customer and service."},
                status=400,
            )

        if not appointment_date or not appointment_time:
            return JsonResponse(
                {"error": "Please enter a valid date and time."},
                status=400,
            )

        if appointment_date < date.today():
            return JsonResponse(
                {"error": "Appointment date cannot be in the past."},
                status=400,
            )

        customer = Customer.objects.get(id=customer_id)
        service = Service.objects.get(id=service_id, is_active=True)

        staff = None
        if staff_id:
            staff = Staff.objects.get(id=staff_id, is_active=True)

        if role == "customer":
            if not email:
                return JsonResponse(
                    {"error": "Customer email is required to book."},
                    status=401,
                )

            if customer.email.strip().lower() != email:
                return JsonResponse(
                    {"error": "You can book an appointment only for your own account."},
                    status=403,
                )

        elif role and not (_is_staff_role(role) or role == "stylist"):
            return JsonResponse({"error": "Invalid role."}, status=403)

        schedule_error = _staff_schedule_error(
            staff, appointment_date, appointment_time, service
        )
        if schedule_error:
            return JsonResponse({"error": schedule_error}, status=400)

        if _has_staff_time_conflict(

            staff,

            appointment_date,

            appointment_time,

            service,

        ):

            return JsonResponse({"error": "This staff member already has an appointment during this time."}, status=409)


        appointment = Appointment.objects.create(
            customer=customer,
            service=service,
            staff=staff,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            notes=notes,
        )

        from .notification_views import create_notification
        create_notification(
            "appointment",
            "New appointment booked",
            f"{customer.full_name} booked {service.name} for "
            f"{appointment_date:%d/%m/%Y} at {appointment_time.strftime('%H:%M')}.",
            related_id=f"appointment-booked:{appointment.id}",
        )

        appointment = Appointment.objects.select_related(
            "customer", "service", "staff"
        ).get(id=appointment.id)

        return JsonResponse({
            "message": "Appointment booked successfully.",
            "appointment": appointment_to_dict(appointment),
            "appointment_id": appointment.id,
        }, status=201)

    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found."}, status=404)
    except Service.DoesNotExist:
        return JsonResponse({"error": "Active service not found."}, status=404)
    except Staff.DoesNotExist:
        return JsonResponse(
            {"error": "Active staff member not found."},
            status=404,
        )
    except (json.JSONDecodeError, ValueError, TypeError, AttributeError):
        return JsonResponse(
            {"error": "Please enter valid appointment details."},
            status=400,
        )


# ---------------- UPDATE APPOINTMENT STATUS ----------------

@csrf_exempt
@require_http_methods(["PATCH"])
def update_appointment_status_api(request, appointment_id):
    try:
        body = json.loads(request.body or "{}")
        role, email = _request_role_and_email(request, body)

        if not _is_staff_role(role):
            return JsonResponse(
                {"error": "Only admin or receptionist can change appointment status."},
                status=403,
            )

        appointment = Appointment.objects.select_related(
            "customer", "service", "staff"
        ).get(id=appointment_id)

        new_status = str(body.get("status", "")).strip().lower()
        allowed_statuses = ["pending", "confirmed", "completed", "cancelled"]

    
        if new_status not in allowed_statuses:
            return JsonResponse(
                {"error": "Invalid appointment status."},
                status=400,
            )

        # Prevent overlapping confirmed appointments using service duration.
        if new_status == "confirmed" and appointment.staff:
            schedule_error = _staff_schedule_error(
                appointment.staff,
                appointment.appointment_date,
                appointment.appointment_time,
                appointment.service,
            )
            if schedule_error:
                return JsonResponse({"error": schedule_error}, status=400)

            overlapping_appointment = _has_staff_time_conflict(
                staff=appointment.staff,
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.appointment_time,
                service=appointment.service,
                exclude_appointment_id=appointment.id,
                conflict_statuses=["confirmed"],
            )

            if overlapping_appointment:
                return JsonResponse(
                    {
                        "error": (
                            "This staff member already has a confirmed "
                            "appointment overlapping this time."
                        )
                    },
                    status=409,
                )

        previous_status = appointment.status
        appointment.status = new_status
        appointment.save(update_fields=["status"])

        if previous_status != new_status:
            actor = getattr(request, "salon_api_user", None)
            AuditLog.objects.create(
                entity_type="appointment",
                entity_id=str(appointment.id),
                action="status_changed",
                old_value=previous_status,
                new_value=new_status,
                actor_email=actor.email if actor else "",
                actor_role=actor.role if actor else "",
            )

        if previous_status != new_status:
            from .notification_views import create_notification
            status_titles = {
                "pending": "Appointment set to pending",
                "confirmed": "Appointment confirmed",
                "completed": "Appointment completed",
                "cancelled": "Appointment cancelled",
            }
            create_notification(
                "appointment",
                status_titles[new_status],
                f"Appointment for {appointment.customer.full_name} - "
                f"{appointment.service.name} on "
                f"{appointment.appointment_date:%d/%m/%Y} is now {new_status}.",
                related_id=f"appointment-status:{appointment.id}:{new_status}",
            )

        return JsonResponse({
            "message": "Appointment status updated.",
            "appointment": appointment_to_dict(appointment),
        })

    except Appointment.DoesNotExist:
        return JsonResponse({"error": "Appointment not found."}, status=404)
    except (json.JSONDecodeError, AttributeError, TypeError):
        return JsonResponse({"error": "Invalid request data."}, status=400)


# ---------------- EDIT APPOINTMENT API ----------------

@csrf_exempt
@require_http_methods(["PUT"])
def edit_appointment_api(request, appointment_id):
    try:
        body = json.loads(request.body or "{}")
        role, email = _request_role_and_email(request, body)

        if not _is_staff_role(role):
            return JsonResponse(
                {"error": "Only admin or receptionist can edit appointments."},
                status=403,
            )

        appointment = Appointment.objects.select_related(
            "customer", "service", "staff"
        ).get(id=appointment_id)

        if "customer_id" in body:
            appointment.customer = Customer.objects.get(
                id=int(body["customer_id"])
            )

        if "service_id" in body:
            appointment.service = Service.objects.get(
                id=int(body["service_id"]),
                is_active=True,
            )

        if "staff_id" in body:
            staff_id = int(body.get("staff_id") or 0)

            if staff_id:
                appointment.staff = Staff.objects.get(
                    id=staff_id,
                    is_active=True,
                )
            else:
                appointment.staff = None

        if "appointment_date" in body:
            new_date = parse_date(body["appointment_date"])

            if not new_date:
                return JsonResponse(
                    {"error": "Invalid appointment date."},
                    status=400,
                )

            if new_date < date.today():
                return JsonResponse(
                    {"error": "Appointment date cannot be in the past."},
                    status=400,
                )

            appointment.appointment_date = new_date

        if "appointment_time" in body:
            new_time = parse_time(body["appointment_time"])

            if not new_time:
                return JsonResponse(
                    {"error": "Invalid appointment time."},
                    status=400,
                )

            appointment.appointment_time = new_time

        if "notes" in body:
            appointment.notes = str(body["notes"]).strip()

        if appointment.status != "cancelled":
            schedule_error = _staff_schedule_error(
                appointment.staff,
                appointment.appointment_date,
                appointment.appointment_time,
                appointment.service,
            )
            if schedule_error:
                return JsonResponse({"error": schedule_error}, status=400)

        if appointment.status != "cancelled" and _has_staff_time_conflict(
            appointment.staff,
            appointment.appointment_date,
            appointment.appointment_time,
            appointment.service,
            exclude_appointment_id=appointment.id,
        ):
            return JsonResponse({"error": "This staff member already has an appointment during this time."}, status=409)

        appointment.save()

        appointment = Appointment.objects.select_related(
            "customer", "service", "staff"
        ).get(id=appointment.id)

        return JsonResponse({
            "message": "Appointment updated successfully.",
            "appointment": appointment_to_dict(appointment),
        })

    except Appointment.DoesNotExist:
        return JsonResponse({"error": "Appointment not found."}, status=404)
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found."}, status=404)
    except Service.DoesNotExist:
        return JsonResponse({"error": "Active service not found."}, status=404)
    except Staff.DoesNotExist:
        return JsonResponse(
            {"error": "Active staff member not found."},
            status=404,
        )
    except (json.JSONDecodeError, ValueError, TypeError, AttributeError):
        return JsonResponse(
            {"error": "Invalid appointment details."},
            status=400,
        )


# ---------------- DELETE APPOINTMENT API ----------------

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_appointment_api(request, appointment_id):
    role, email = _request_role_and_email(request)

    if not _is_staff_role(role):
        return JsonResponse(
            {"error": "Only admin or receptionist can delete appointments."},
            status=403,
        )

    try:
        appointment = Appointment.objects.get(id=appointment_id)
        appointment.delete()

        return JsonResponse({
            "message": "Appointment deleted successfully."
        })

    except Appointment.DoesNotExist:
        return JsonResponse({"error": "Appointment not found."}, status=404)


# ---------------- PACKAGES API ----------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def packages_api(request):
    if request.method == "GET":
        packages = Package.objects.prefetch_related(
            "services"
        ).order_by("-id")

        data = []

        for p in packages:
            data.append({
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "services": [
                    {"id": s.id, "name": s.name}
                    for s in p.services.all()
                ],
                "price": str(p.price),
                "validity_days": p.validity_days,
                "included_visits": p.included_visits,
                "is_active": p.is_active,
            })

        return JsonResponse(data, safe=False)

    try:
        body = json.loads(request.body or "{}")

        name = body.get("name", "").strip()
        description = body.get("description", "").strip()
        price = Decimal(str(body.get("price", "")))
        validity_days = int(body.get("validity_days", 30))
        included_visits = int(body.get("included_visits", 1))
        service_ids = body.get("service_ids", [])

        if (
            not name
            or not price.is_finite()
            or price < 0
            or validity_days <= 0
            or included_visits <= 0
        ):
            return JsonResponse(
                {"error": "Enter a name, valid price, validity and included visits."},
                status=400,
            )

        package = Package.objects.create(
            name=name,
            description=description,
            price=price,
            validity_days=validity_days,
            included_visits=included_visits,
            is_active=True,
        )

        services = Service.objects.filter(
            id__in=service_ids,
            is_active=True,
        )
        package.services.set(services)

        return JsonResponse({
            "message": "Package added successfully.",
            "id": package.id,
        }, status=201)

    except (json.JSONDecodeError, InvalidOperation, ValueError, TypeError):
        return JsonResponse(
            {"error": "Please enter valid package details."},
            status=400,
        )


@csrf_exempt
@require_http_methods(["PUT"])
def edit_package_api(request, package_id):
    try:
        package = Package.objects.get(id=package_id)
        body = json.loads(request.body or "{}")

        if "name" in body:
            name = body["name"].strip()
            if not name:
                return JsonResponse(
                    {"error": "Package name is required."},
                    status=400,
                )
            package.name = name

        if "description" in body:
            package.description = body["description"].strip()

        if "price" in body:
            price = Decimal(str(body["price"]))
            if price < 0:
                return JsonResponse(
                    {"error": "Price cannot be negative."},
                    status=400,
                )
            package.price = price

        if "validity_days" in body:
            days = int(body["validity_days"])
            if days <= 0:
                return JsonResponse(
                    {"error": "Validity must be greater than zero."},
                    status=400,
                )
            package.validity_days = days

        if "included_visits" in body:
            visits = int(body["included_visits"])
            if visits <= 0:
                return JsonResponse(
                    {"error": "Included visits must be greater than zero."},
                    status=400,
                )
            package.included_visits = visits

        if "service_ids" in body:
            services = Service.objects.filter(
                id__in=body["service_ids"],
                is_active=True,
            )
            package.services.set(services)

        package.save()

        return JsonResponse({
            "message": "Package updated successfully."
        })

    except Package.DoesNotExist:
        return JsonResponse({"error": "Package not found."}, status=404)
    except (
        json.JSONDecodeError,
        InvalidOperation,
        ValueError,
        TypeError,
        AttributeError,
    ):
        return JsonResponse(
            {"error": "Invalid package details."},
            status=400,
        )


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_package_api(request, package_id):
    try:
        package = Package.objects.get(id=package_id)
        package.is_active = False
        package.save(update_fields=["is_active"])

        return JsonResponse({
            "message": "Package deleted successfully."
        })

    except Package.DoesNotExist:
        return JsonResponse({"error": "Package not found."}, status=404)


# ---------------- CUSTOMER PACKAGE PURCHASE API ----------------

def customer_package_to_dict(purchase):
    today = timezone.localdate()

    if purchase.status == "cancelled":
        expiry_status = "Cancelled"
    elif purchase.status == "expired" or (
        purchase.expiry_date and purchase.expiry_date < today
    ):
        expiry_status = "Expired"
    elif purchase.payment_status != "paid":
        expiry_status = "Payment Pending"
    elif purchase.status != "confirmed":
        expiry_status = "Awaiting Confirmation"
    elif purchase.expiry_date and purchase.expiry_date <= today + timedelta(days=7):
        expiry_status = "Expiring Soon"
    else:
        expiry_status = "Active"

    return {
        "id": purchase.id,
        "customer_id": purchase.customer_id,
        "customer_name": purchase.customer.full_name,
        "customer_email": purchase.customer.email,
        "package_id": purchase.package_id,
        "package_name": purchase.package.name,
        "description": purchase.package.description,
        "services": [
            {"id": service.id, "name": service.name}
            for service in purchase.package.services.all()
        ],
        "price": str(purchase.package.price),
        "validity_days": purchase.package.validity_days,
        "included_visits": purchase.package.included_visits,
        "remaining_visits": purchase.remaining_visits,
        "purchase_date": purchase.purchase_date.isoformat(),
        "expiry_date": (
            purchase.expiry_date.isoformat()
            if purchase.expiry_date else None
        ),
        "expiry_status": expiry_status,
        "status": purchase.status,
        "payment_status": purchase.payment_status,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def customer_packages_api(request):
    if request.method == "GET":
        role, email = _request_role_and_email(request)

        purchases = CustomerPackage.objects.select_related(
            "customer", "package"
        ).order_by("-purchase_date")

        if role == "customer":
            if not email:
                return JsonResponse(
                    {"error": "Customer email is required."},
                    status=401,
                )
            purchases = purchases.filter(customer__email__iexact=email)

        elif role and not _is_staff_role(role):
            return JsonResponse(
                {"error": "Only customers and staff can view purchases."},
                status=403,
            )

        return JsonResponse(
            [customer_package_to_dict(p) for p in purchases],
            safe=False,
        )

    try:
        body = json.loads(request.body or "{}")
        role, email = _request_role_and_email(request, body)

        if role != "customer":
            return JsonResponse(
                {"error": "Please log in as a customer to buy a package."},
                status=403,
            )

        if not email:
            return JsonResponse(
                {"error": "Customer email is required."},
                status=401,
            )

        package_id = int(body.get("package_id", 0))

        if package_id <= 0:
            return JsonResponse(
                {"error": "Please select a package."},
                status=400,
            )

        customer = Customer.objects.get(email__iexact=email)
        package = Package.objects.get(id=package_id, is_active=True)

        already_purchased = CustomerPackage.objects.filter(
            customer=customer,
            package=package,
            status__in=["pending", "confirmed"],
        ).exists()

        if already_purchased:
            return JsonResponse(
                {
                    "error": (
                        "You already have this package purchased "
                        "or awaiting confirmation."
                    )
                },
                status=400,
            )

        purchase = CustomerPackage.objects.create(
            customer=customer,
            package=package,
            expiry_date=timezone.localdate() + timedelta(
                days=package.validity_days
            ),
            status="pending",
            payment_status="pending",
        )

        purchase = CustomerPackage.objects.select_related(
            "customer", "package"
        ).get(id=purchase.id)

        return JsonResponse({
            "message": "Package request submitted. Please pay at the salon.",
            "purchase": customer_package_to_dict(purchase),
        }, status=201)

    except Customer.DoesNotExist:
        return JsonResponse(
            {
                "error": (
                    "Your customer profile was not found. "
                    "Please contact the salon."
                )
            },
            status=404,
        )
    except Package.DoesNotExist:
        return JsonResponse(
            {"error": "Active package not found."},
            status=404,
        )
    except (json.JSONDecodeError, ValueError, TypeError, AttributeError):
        return JsonResponse(
            {"error": "Please send valid package details."},
            status=400,
        )


@csrf_exempt
@require_http_methods(["PATCH"])
def update_customer_package_api(request, purchase_id):
    role, _email = _request_role_and_email(request)

    if not _is_staff_role(role):
        return JsonResponse(
            {"error": "Only admin or receptionist can update package purchases."},
            status=403,
        )

    try:
        body = json.loads(request.body or "{}")

        purchase = CustomerPackage.objects.select_related(
            "customer", "package"
        ).get(id=purchase_id)

        previous_payment_status = purchase.payment_status

        if "status" in body:
            new_status = str(body["status"]).strip().lower()

            if new_status not in [
                "pending", "confirmed", "cancelled", "expired"
            ]:
                return JsonResponse(
                    {"error": "Invalid purchase status."},
                    status=400,
                )

            purchase.status = new_status

        if "payment_status" in body:
            payment_status = str(body["payment_status"]).strip().lower()

            if payment_status not in ["pending", "paid"]:
                return JsonResponse(
                    {"error": "Invalid payment status."},
                    status=400,
                )

            purchase.payment_status = payment_status

        # Initialize visits only when payment first becomes paid.
        # Repeated updates must not restore visits already consumed.
        if (
            previous_payment_status != "paid"
            and purchase.payment_status == "paid"
        ):
            purchase.remaining_visits = purchase.package.included_visits

        # Only Admin/Receptionist can reach this endpoint.
        # A visit can be consumed only for a confirmed, paid, valid package.
        if body.get("consume_visit"):
            today = timezone.localdate()

            if purchase.status != "confirmed":
                return JsonResponse(
                    {"error": "Confirm the package before using visits."},
                    status=400,
                )

            if purchase.payment_status != "paid":
                return JsonResponse(
                    {"error": "Payment must be marked paid before using visits."},
                    status=400,
                )

            if purchase.status == "expired" or (
                purchase.expiry_date and purchase.expiry_date < today
            ):
                return JsonResponse(
                    {"error": "This package has expired."},
                    status=400,
                )

            if purchase.remaining_visits <= 0:
                return JsonResponse(
                    {"error": "No remaining visits are available."},
                    status=400,
                )

            purchase.remaining_visits -= 1

        purchase.save()
        purchase.refresh_from_db()

        return JsonResponse({
            "message": "Package purchase updated successfully.",
            "purchase": customer_package_to_dict(purchase),
        })

    except CustomerPackage.DoesNotExist:
        return JsonResponse(
            {"error": "Package purchase not found."},
            status=404,
        )
    except (json.JSONDecodeError, AttributeError, TypeError):
        return JsonResponse(
            {"error": "Invalid purchase details."},
            status=400,
        )


# ---------------- BILLING API ----------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def bills_api(request):
    if request.method == "GET":
        bills = Bill.objects.select_related(
            "customer", "appointment", "appointment__service"
        ).order_by("id")

        data = []
        for bill in bills:
            data.append({
                "id": bill.id,
                "customer_id": bill.customer_id,
                "customer_name": bill.customer.full_name,
                "appointment_id": bill.appointment_id,
                "service_name": (
                    bill.appointment.service.name
                    if bill.appointment else ""
                ),
                "subtotal_amount": str(
                    bill.subtotal_amount
                    if bill.subtotal_amount is not None
                    else bill.total_amount
                ),
                "discount_amount": str(bill.discount_amount),
                "additional_charges": str(bill.additional_charges),
                "tax_amount": str(bill.tax_amount),
                "total_amount": str(bill.total_amount),
                "payment_method": bill.payment_method,
                "payment_status": bill.payment_status,
                "created_at": bill.created_at.strftime("%Y-%m-%d %H:%M"),
            })

        return JsonResponse(data, safe=False)

    try:
        body = json.loads(request.body or "{}")
        customer_id = int(body.get("customer_id", 0))
        appointment_id = body.get("appointment_id")

        subtotal_raw = body.get(
            "subtotal_amount", body.get("total_amount", "")
        )
        if subtotal_raw in [None, ""] and appointment_id in [None, ""]:
            return JsonResponse(
                {"error": "Select an appointment or enter a subtotal."},
                status=400,
            )

        subtotal_amount = Decimal(str(subtotal_raw or "0"))
        discount_amount = Decimal(str(body.get("discount_amount", "0")))
        additional_charges = Decimal(
            str(body.get("additional_charges", "0"))
        )
        tax_amount = Decimal(str(body.get("tax_amount", "0")))
        payment_method = str(body.get("payment_method", "cash")).lower()
        payment_status = str(body.get("payment_status", "pending")).lower()

        amounts = [
            subtotal_amount,
            discount_amount,
            additional_charges,
            tax_amount,
        ]
        if customer_id <= 0 or any(
            not amount.is_finite() or amount < 0 for amount in amounts
        ):
            return JsonResponse(
                {"error": "Enter valid non-negative bill amounts."},
                status=400,
            )

        if payment_method not in ["cash", "upi", "card", "online"]:
            return JsonResponse(
                {"error": "Invalid payment method."}, status=400
            )

        if payment_status not in ["pending", "paid", "cancelled"]:
            return JsonResponse(
                {"error": "Invalid payment status."}, status=400
            )

        customer = Customer.objects.get(id=customer_id)
        appointment = None

        if appointment_id not in [None, ""]:
            appointment = Appointment.objects.select_related(
                "service"
            ).get(id=int(appointment_id), customer=customer)

            # The backend service price is authoritative for linked bills.
            subtotal_amount = appointment.service.price

        if discount_amount > subtotal_amount:
            return JsonResponse(
                {"error": "Discount cannot exceed the subtotal."},
                status=400,
            )

        total_amount = (
            subtotal_amount
            + additional_charges
            + tax_amount
            - discount_amount
        ).quantize(Decimal("0.01"))

        bill = Bill.objects.create(
            customer=customer,
            appointment=appointment,
            subtotal_amount=subtotal_amount,
            discount_amount=discount_amount,
            additional_charges=additional_charges,
            tax_amount=tax_amount,
            total_amount=total_amount,
            payment_method=payment_method,
            payment_status=payment_status,
        )

        if bill.payment_status == "paid":
            from .notification_views import create_notification
            create_notification(
                "payment",
                "Payment received",
                f"Payment of Rs. {bill.total_amount} received from "
                f"{bill.customer.full_name} for bill #{bill.id}.",
                related_id=f"bill-paid:{bill.id}",
            )

        return JsonResponse({
            "message": "Bill created successfully.",
            "id": bill.id,
            "subtotal_amount": str(bill.subtotal_amount),
            "discount_amount": str(bill.discount_amount),
            "additional_charges": str(bill.additional_charges),
            "tax_amount": str(bill.tax_amount),
            "total_amount": str(bill.total_amount),
        }, status=201)

    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found."}, status=404)
    except Appointment.DoesNotExist:
        return JsonResponse(
            {"error": "Appointment not found for this customer."},
            status=404,
        )
    except (json.JSONDecodeError, InvalidOperation, ValueError, TypeError):
        return JsonResponse(
            {"error": "Please enter valid bill details."}, status=400
        )


@csrf_exempt
@require_http_methods(["PATCH"])
def update_bill_api(request, bill_id):
    try:
        bill = Bill.objects.select_related(
            "customer", "appointment", "appointment__service"
        ).get(id=bill_id)
        previous_payment_status = bill.payment_status
        body = json.loads(request.body or "{}")

        if "customer_id" in body:
            customer_id = int(body["customer_id"])
            if customer_id <= 0:
                return JsonResponse(
                    {"error": "Please select a valid customer."},
                    status=400,
                )
            bill.customer = Customer.objects.get(id=customer_id)

        linked_appointment_selected = False
        if "appointment_id" in body:
            appointment_id = body["appointment_id"]
            if appointment_id in [None, ""]:
                bill.appointment = None
            else:
                appointment = Appointment.objects.select_related(
                    "service"
                ).get(id=int(appointment_id))

                if appointment.customer_id != bill.customer_id:
                    return JsonResponse(
                        {
                            "error": (
                                "Appointment must belong to the selected "
                                "customer."
                            )
                        },
                        status=400,
                    )

                bill.appointment = appointment
                bill.subtotal_amount = appointment.service.price
                linked_appointment_selected = True

        # For a bill without a linked appointment, allow manual subtotal entry.
        if not linked_appointment_selected:
            if "subtotal_amount" in body or "total_amount" in body:
                raw_subtotal = body.get(
                    "subtotal_amount", body.get("total_amount")
                )
                bill.subtotal_amount = Decimal(str(raw_subtotal))
            elif bill.subtotal_amount is None:
                # Keep historical bills intact if only status/method is edited.
                bill.subtotal_amount = bill.total_amount

        for field in [
            "discount_amount", "additional_charges", "tax_amount"
        ]:
            if field in body:
                setattr(bill, field, Decimal(str(body[field])))

        bill.subtotal_amount = (
            bill.subtotal_amount
            if bill.subtotal_amount is not None
            else bill.total_amount
        )

        amounts = [
            bill.subtotal_amount,
            bill.discount_amount,
            bill.additional_charges,
            bill.tax_amount,
        ]
        if any(
            not amount.is_finite() or amount < 0 for amount in amounts
        ):
            return JsonResponse(
                {"error": "Enter valid non-negative bill amounts."},
                status=400,
            )

        if bill.discount_amount > bill.subtotal_amount:
            return JsonResponse(
                {"error": "Discount cannot exceed the subtotal."},
                status=400,
            )

        if "payment_method" in body:
            method = str(body["payment_method"]).lower()
            if method not in ["cash", "upi", "card", "online"]:
                return JsonResponse(
                    {"error": "Invalid payment method."}, status=400
                )
            bill.payment_method = method

        if "payment_status" in body:
            payment_status = str(body["payment_status"]).lower()
            if payment_status not in ["pending", "paid", "cancelled"]:
                return JsonResponse(
                    {"error": "Invalid payment status."}, status=400
                )
            bill.payment_status = payment_status

        bill.total_amount = (
            bill.subtotal_amount
            + bill.additional_charges
            + bill.tax_amount
            - bill.discount_amount
        ).quantize(Decimal("0.01"))

        bill.save()


        if previous_payment_status != bill.payment_status:

            actor = getattr(request, "salon_api_user", None)

            AuditLog.objects.create(

                entity_type="bill",

                entity_id=str(bill.id),

                action="payment_status_changed",

                old_value=previous_payment_status,

                new_value=bill.payment_status,

                actor_email=actor.email if actor else "",

                actor_role=actor.role if actor else "",

            )
        if (
            previous_payment_status != "paid"
            and bill.payment_status == "paid"
        ):
            from .notification_views import create_notification
            create_notification(
                "payment",
                "Payment received",
                f"Payment of Rs. {bill.total_amount} received from "
                f"{bill.customer.full_name} for bill #{bill.id}.",
                related_id=f"bill-paid:{bill.id}",
            )

        return JsonResponse({
            "message": "Bill updated successfully.",
            "id": bill.id,
            "customer_id": bill.customer_id,
            "appointment_id": bill.appointment_id,
            "subtotal_amount": str(bill.subtotal_amount),
            "discount_amount": str(bill.discount_amount),
            "additional_charges": str(bill.additional_charges),
            "tax_amount": str(bill.tax_amount),
            "total_amount": str(bill.total_amount),
            "payment_method": bill.payment_method,
            "payment_status": bill.payment_status,
        })

    except Bill.DoesNotExist:
        return JsonResponse({"error": "Bill not found."}, status=404)
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found."}, status=404)
    except Appointment.DoesNotExist:
        return JsonResponse({"error": "Appointment not found."}, status=404)
    except (
        json.JSONDecodeError,
        InvalidOperation,
        ValueError,
        TypeError,
        AttributeError,
    ):
        return JsonResponse(
            {"error": "Please enter valid bill details."}, status=400
        )


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_bill_api(request, bill_id):
    try:
        bill = Bill.objects.get(id=bill_id)
        bill.delete()

        return JsonResponse({"message": "Bill deleted successfully."})

    except Bill.DoesNotExist:
        return JsonResponse({"error": "Bill not found."}, status=404)


# ---------------- STAFF API ----------------

@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "DELETE"])
def staff_api(request):
    if request.method == "GET":
        staff_members = Staff.objects.all().order_by("-id")

        data = [
            {
                "id": staff.id,
                "full_name": staff.full_name,
                "email": staff.email,
                "phone": staff.phone,
                "role": staff.role,
                "specializations": staff.specializations,
                "working_days": staff.working_days,
                "start_time": (
                    staff.start_time.strftime("%H:%M")
                    if staff.start_time else ""
                ),
                "end_time": (
                    staff.end_time.strftime("%H:%M")
                    if staff.end_time else ""
                ),
                "is_active": staff.is_active,
            }
            for staff in staff_members
        ]

        return JsonResponse(data, safe=False)

    try:
        data = json.loads(request.body or "{}")

        if request.method == "POST":
            full_name = data.get("full_name", "").strip()
            email = data.get("email", "").strip().lower()
            phone = data.get("phone", "").strip()

            if not full_name or not email or not phone:
                return JsonResponse(
                    {"error": "Name, email and phone are required."},
                    status=400,
                )

            if Staff.objects.filter(email=email).exists():
                return JsonResponse(
                    {"error": "This staff email is already registered."},
                    status=400,
                )

            staff = Staff.objects.create(
                full_name=full_name,
                email=email,
                phone=phone,
                role=data.get("role", "stylist"),
                specializations=data.get("specializations", ""),
                working_days=data.get("working_days", ""),
                start_time=data.get("start_time") or None,
                end_time=data.get("end_time") or None,
                is_active=data.get("is_active", True),
            )

            return JsonResponse({
                "message": "Staff added successfully.",
                "id": staff.id,
            }, status=201)

        staff_id = data.get("id")

        if not staff_id:
            return JsonResponse(
                {"error": "Staff ID is required."},
                status=400,
            )

        staff = Staff.objects.get(id=staff_id)

        if request.method == "DELETE":
            staff.delete()
            return JsonResponse({
                "message": "Staff deleted successfully."
            })

        for field in [
            "full_name", "email", "phone", "role",
            "specializations", "working_days", "is_active"
        ]:
            if field in data:
                value = data[field]
                if field in ["full_name", "email", "phone", "role"]:
                    value = str(value).strip()
                if field == "email":
                    value = value.lower()
                setattr(staff, field, value)

        for field in ["start_time", "end_time"]:
            if field in data:
                setattr(staff, field, data[field] or None)

        staff.save()

        return JsonResponse({
            "message": "Staff updated successfully."
        })

    except Staff.DoesNotExist:
        return JsonResponse({"error": "Staff not found."}, status=404)
    except (json.JSONDecodeError, ValueError, TypeError, AttributeError):
        return JsonResponse(
            {"error": "Please enter valid staff details."},
            status=400,
        )



# ---------------- CUSTOMER HISTORY API ----------------

@require_http_methods(["GET"])
def customer_history_api(request, customer_id):
    try:
        customer = Customer.objects.get(id=customer_id)

        appointments = Appointment.objects.filter(
            customer=customer
        ).select_related("service", "staff").order_by(
            "-appointment_date", "-appointment_time"
        )

        bills = Bill.objects.filter(
            customer=customer
        ).select_related(
            "appointment", "appointment__service"
        ).order_by("-created_at")

        return JsonResponse({
            "customer": {
                "id": customer.id,
                "full_name": customer.full_name,
                "email": customer.email,
                "phone": customer.phone,
            },
            "appointments": [
                {
                    "id": a.id,
                    "service": a.service.name,
                    "date": a.appointment_date.isoformat(),
                    "time": a.appointment_time.strftime("%H:%M"),
                    "staff": a.staff.full_name if a.staff else "",
                    "status": a.status,
                    "price": str(a.service.price),
                }
                for a in appointments
            ],
            "bills": [
                {
                    "id": b.id,
                    "appointment_id": b.appointment_id,
                    "service": (
                        b.appointment.service.name
                        if b.appointment and b.appointment.service
                        else ""
                    ),
                    "total_amount": str(b.total_amount),
                    "payment_method": b.payment_method,
                    "payment_status": b.payment_status,
                    "created_at": b.created_at.strftime("%Y-%m-%d %H:%M"),
                }
                for b in bills
            ],
        })

    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found."}, status=404)


# NOTIFICATION HOOKS INSTALLED


# MEMBERSHIP VISITS API UPDATED
