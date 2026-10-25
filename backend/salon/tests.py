from datetime import date, time, timedelta
from decimal import Decimal
import json

from django.test import TestCase
from django.urls import reverse

from .models import Customer, Service, Staff, Appointment, Bill


class SalonAppointmentBillingTests(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(
            full_name="Test Customer",
            email="testcustomer@example.com",
            phone="9876543210",
        )
        self.service = Service.objects.create(
            name="Test Facial",
            price=Decimal("500.00"),
            duration_minutes=60,
        )
        self.staff = Staff.objects.create(
            full_name="Test Stylist",
            email="stylist@example.com",
            phone="9876543211",
        )
        self.appointment = Appointment.objects.create(
            customer=self.customer,
            service=self.service,
            staff=self.staff,
            appointment_date=date.today() + timedelta(days=2),
            appointment_time=time(10, 0),
            status="confirmed",
        )

    def test_service_price_is_saved_correctly(self):
        self.assertEqual(self.service.price, Decimal("500.00"))

    def test_appointment_is_linked_to_customer_and_service(self):
        self.assertEqual(self.appointment.customer, self.customer)
        self.assertEqual(self.appointment.service, self.service)

    def test_bill_can_store_service_price(self):
        bill = Bill.objects.create(
            customer=self.customer,
            appointment=self.appointment,
            total_amount=self.service.price,
            payment_method="cash",
            payment_status="pending",
        )
        self.assertEqual(bill.total_amount, Decimal("500.00"))
        self.assertEqual(bill.appointment, self.appointment)
    def test_overlapping_appointment_is_detected(self):
        from .views import _has_staff_time_conflict

        has_conflict = _has_staff_time_conflict(
            staff=self.staff,
            appointment_date=self.appointment.appointment_date,
            appointment_time=time(10, 30),
            service=self.service,
            exclude_appointment_id=None,
        )

        self.assertTrue(has_conflict)

    def test_back_to_back_appointment_has_no_conflict(self):
        from .views import _has_staff_time_conflict

        has_conflict = _has_staff_time_conflict(
            staff=self.staff,
            appointment_date=self.appointment.appointment_date,
            appointment_time=time(11, 0),
            service=self.service,
            exclude_appointment_id=None,
        )

        self.assertFalse(has_conflict)
    def test_confirmation_conflict_checks_confirmed_status_only(self):
        from .views import _has_staff_time_conflict

        self.appointment.status = "pending"
        self.appointment.save(update_fields=["status"])

        has_conflict = _has_staff_time_conflict(
            staff=self.staff,
            appointment_date=self.appointment.appointment_date,
            appointment_time=time(10, 30),
            service=self.service,
            conflict_statuses=["confirmed"],
        )
        self.assertFalse(has_conflict)

        self.appointment.status = "confirmed"
        self.appointment.save(update_fields=["status"])

        has_conflict = _has_staff_time_conflict(
            staff=self.staff,
            appointment_date=self.appointment.appointment_date,
            appointment_time=time(10, 30),
            service=self.service,
            conflict_statuses=["confirmed"],
        )
        self.assertTrue(has_conflict)

