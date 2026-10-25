
import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import StaffMember


def _sync_appointment_staff(person, old_name=None, old_phone=None, deactivate=False):
    """Keep Staff Management and appointment staff records aligned."""
    from salon.models import Staff as AppointmentStaff

    appointment_staff = None

    # Prefer the previous name + phone when editing or deactivating.
    if old_name and old_phone:
        appointment_staff = AppointmentStaff.objects.filter(
            full_name__iexact=old_name,
            phone=old_phone,
        ).order_by("id").first()

    # Use phone only when exactly one schedule record matches.
    if appointment_staff is None and old_phone:
        matches = AppointmentStaff.objects.filter(
            phone=old_phone
        ).order_by("id")
        if matches.count() == 1:
            appointment_staff = matches.first()

    # Reuse a matching record if staff is being added again.
    if appointment_staff is None:
        matches = AppointmentStaff.objects.filter(
            full_name__iexact=person.name,
            phone=person.phone,
        ).order_by("id")
        if matches.count() == 1:
            appointment_staff = matches.first()

    if deactivate:
        # Keep the scheduling record so existing appointment history is preserved.
        if appointment_staff is not None:
            appointment_staff.is_active = False
            appointment_staff.save(update_fields=["is_active"])
        return

    role_map = {
        "Beautician": "stylist",
        "Hair Stylist": "stylist",
        "Receptionist": "receptionist",
        "Manager": "manager",
    }
    mapped_role = role_map.get(person.role, "stylist")

    if appointment_staff is None:
        email = (getattr(person, "email", "") or "").strip().lower()

        if not email or AppointmentStaff.objects.filter(
            email__iexact=email
        ).exists():
            email = f"staffmember-{person.pk}@example.com"

        suffix = 1
        base_email = email
        while AppointmentStaff.objects.filter(email__iexact=email).exists():
            email = f"staffmember-{person.pk}-{suffix}@example.com"
            suffix += 1

        appointment_staff = AppointmentStaff(
            full_name=person.name,
            email=email,
            phone=person.phone,
            role=mapped_role,
            specializations="",
            working_days="",
            start_time=None,
            end_time=None,
            is_active=True,
        )
    else:
        appointment_staff.full_name = person.name
        appointment_staff.phone = person.phone
        appointment_staff.role = mapped_role
        appointment_staff.is_active = True

        email = (getattr(person, "email", "") or "").strip().lower()
        if email and not AppointmentStaff.objects.filter(
            email__iexact=email
        ).exclude(pk=appointment_staff.pk).exists():
            appointment_staff.email = email

    # Preserve existing working days, shift times and specializations.
    appointment_staff.save()



@csrf_exempt
@require_http_methods(["GET", "POST"])
def staff_list(request):
    if request.method == "GET":
        staff = StaffMember.objects.all().order_by("-id")
        data = [
            {
                "id": person.id,
                "name": person.name,
                "phone": person.phone,
                "role": person.role,
                "salary": str(person.salary),
                "workingHours": person.working_hours,
            }
            for person in staff
        ]
        return JsonResponse(data, safe=False)

    try:
        body = json.loads(request.body)
        salary = Decimal(str(body.get("salary", "")))

        if salary < 0:
            return JsonResponse({"error": "Salary cannot be negative."}, status=400)

        name = str(body.get("name", "")).strip()
        phone = str(body.get("phone", "")).strip()
        role = str(body.get("role", "")).strip()
        working_hours = str(body.get("workingHours", "")).strip()

        if not all([name, phone, role, working_hours]):
            return JsonResponse({"error": "All fields are required."}, status=400)

        with transaction.atomic():
            person = StaffMember.objects.create(
                name=name,
                phone=phone,
                role=role,
                salary=salary,
                working_hours=working_hours,
            )
            _sync_appointment_staff(person)

        return JsonResponse(
            {"id": person.id, "message": "Staff added successfully."},
            status=201,
        )

    except (ValueError, InvalidOperation, TypeError):
        return JsonResponse({"error": "Invalid staff data."}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def staff_detail(request, staff_id):
    try:
        person = StaffMember.objects.get(id=staff_id)
    except StaffMember.DoesNotExist:
        return JsonResponse({"error": "Staff not found."}, status=404)

    old_name = person.name
    old_phone = person.phone

    if request.method == "DELETE":
        with transaction.atomic():
            _sync_appointment_staff(
                person,
                old_name=old_name,
                old_phone=old_phone,
                deactivate=True,
            )
            person.delete()

        return JsonResponse({"message": "Staff deleted successfully."})

    try:
        body = json.loads(request.body)
        salary = Decimal(str(body.get("salary", "")))

        if salary < 0:
            return JsonResponse({"error": "Salary cannot be negative."}, status=400)

        name = str(body.get("name", "")).strip()
        phone = str(body.get("phone", "")).strip()
        role = str(body.get("role", "")).strip()
        working_hours = str(body.get("workingHours", "")).strip()

        if not all([name, phone, role, working_hours]):
            return JsonResponse({"error": "All fields are required."}, status=400)

        with transaction.atomic():
            person.name = name
            person.phone = phone
            person.role = role
            person.salary = salary
            person.working_hours = working_hours
            person.save()
            _sync_appointment_staff(
                person,
                old_name=old_name,
                old_phone=old_phone,
            )

        return JsonResponse({"message": "Staff updated successfully."})

    except (ValueError, InvalidOperation, TypeError):
        return JsonResponse({"error": "Invalid staff data."}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
