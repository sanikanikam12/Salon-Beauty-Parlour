from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.http import JsonResponse
from django.utils.dateparse import parse_date

from .models import Customer, Service, Appointment, Bill


def reports_api(request):
    if request.method != "GET":
        return JsonResponse(
            {"error": "Only GET requests are allowed."},
            status=405,
        )

    start_raw = request.GET.get("start_date", "")
    end_raw = request.GET.get("end_date", "")

    try:
        start_date = parse_date(start_raw) if start_raw else None
        end_date = parse_date(end_raw) if end_raw else None
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

    if start_raw and start_date is None:
        return JsonResponse({"error": "Invalid start_date. Use YYYY-MM-DD."}, status=400)

    if end_raw and end_date is None:
        return JsonResponse({"error": "Invalid end_date. Use YYYY-MM-DD."}, status=400)

    if start_date and end_date and start_date > end_date:
        return JsonResponse({"error": "Start date cannot be after end date."}, status=400)

    # Appointments are filtered by appointment date.
    appointments = Appointment.objects.select_related(
        "customer", "service", "staff"
    ).all()

    if start_date:
        appointments = appointments.filter(appointment_date__gte=start_date)

    if end_date:
        appointments = appointments.filter(appointment_date__lte=end_date)

    appointments = appointments.order_by(
        "-appointment_date", "-appointment_time"
    )

    # Bills are filtered by bill creation date.
    bills = Bill.objects.select_related(
        "customer", "appointment", "appointment__service"
    ).all()

    if start_date:
        bills = bills.filter(created_at__date__gte=start_date)

    if end_date:
        bills = bills.filter(created_at__date__lte=end_date)

    # Cancelled bills should not count as sales or outstanding payments.
    active_bills = bills.exclude(payment_status="cancelled")
    paid_bills_qs = active_bills.filter(payment_status="paid")
    pending_bills_qs = active_bills.filter(payment_status="pending")

    revenue = paid_bills_qs.aggregate(
        total=Sum("total_amount")
    )["total"] or Decimal("0.00")

    pending_amount = pending_bills_qs.aggregate(
        total=Sum("total_amount")
    )["total"] or Decimal("0.00")

    appointment_rows = [
        {
            "id": item.id,
            "customer_name": item.customer.full_name,
            "service_name": item.service.name,
            "staff_name": item.staff.full_name if item.staff else "Not assigned",
            "date": item.appointment_date.isoformat(),
            "time": item.appointment_time.strftime("%H:%M"),
            "status": item.status,
            "price": float(item.service.price),
        }
        for item in appointments
    ]

    billing_rows = [
        {
            "id": item.id,
            "customer_name": item.customer.full_name,
            "service_name": (
                item.appointment.service.name
                if item.appointment else "Not linked"
            ),
            "amount": float(item.total_amount),
            "payment_method": item.payment_method,
            "status": item.payment_status,
            "date": item.created_at.strftime("%d/%m/%Y"),
        }
        for item in active_bills.order_by("-created_at")
    ]

    daily_sales = (
        paid_bills_qs
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(
            collected_amount=Sum("total_amount"),
            bills_count=Count("id"),
        )
        .order_by("day")
    )

    daily_sales_rows = [
        {
            "date": item["day"].isoformat(),
            "collected_amount": float(item["collected_amount"] or 0),
            "bills_count": item["bills_count"],
        }
        for item in daily_sales
    ]

    popular_services = (
        appointments
        .exclude(status="cancelled")
        .values("service__name")
        .annotate(bookings=Count("id"))
        .order_by("-bookings", "service__name")
    )

    service_rows = [
        {
            "service_name": item["service__name"],
            "bookings": item["bookings"],
        }
        for item in popular_services
    ]

    staff_summary = (
        appointments
        .exclude(status="cancelled")
        .filter(staff__isnull=False)
        .values("staff__full_name")
        .annotate(
            bookings=Count("id"),
            pending=Count("id", filter=Q(status="pending")),
            confirmed=Count("id", filter=Q(status="confirmed")),
            completed=Count("id", filter=Q(status="completed")),
        )
        .order_by("-bookings", "staff__full_name")
    )

    staff_rows = [
        {
            "staff_name": item["staff__full_name"],
            "bookings": item["bookings"],
            "pending": item["pending"],
            "confirmed": item["confirmed"],
            "completed": item["completed"],
        }
        for item in staff_summary
    ]

    outstanding_rows = [
        {
            "bill_id": item.id,
            "customer_name": item.customer.full_name,
            "amount": float(item.total_amount),
            "payment_method": item.payment_method,
            "date": item.created_at.strftime("%d/%m/%Y"),
        }
        for item in pending_bills_qs.order_by("-created_at")
    ]

    return JsonResponse({
        "filters": {
            "start_date": start_date.isoformat() if start_date else "",
            "end_date": end_date.isoformat() if end_date else "",
        },
        "summary": {
            "total_customers": Customer.objects.count(),
            "total_appointments": appointments.count(),
            "total_revenue": float(revenue),
            "paid_bills": paid_bills_qs.count(),
            "total_bills": active_bills.count(),
            "pending_amount": float(pending_amount),
            "total_services": Service.objects.filter(is_active=True).count(),
        },
        "billing_summary": billing_rows,
        "daily_sales": daily_sales_rows,
        "service_popularity": service_rows,
        "staff_bookings": staff_rows,
        "appointments": appointment_rows,
        "outstanding_payments": outstanding_rows,
    })
