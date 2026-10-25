
from django.urls import path
from . import views
from .notification_views import notifications_api, mark_notification_read_api, mark_all_notifications_read_api
from .reports import reports_api

urlpatterns = [
    # CUSTOMERS
    
# CUSTOMERS
path("customers/", views.customers_api, name="customers_api"),
    path("customers/<int:customer_id>/history/", views.customer_history_api, name="customer_history"),
path(
    "customers/<int:customer_id>/edit/",
    views.edit_customer_api,
    name="edit_customer",
),
path(
    "customers/<int:customer_id>/delete/",
    views.delete_customer_api,
    name="delete_customer",
),


    # SERVICES
    path("services/", views.services_api, name="services_api"),
    path("services/add/", views.add_service_api, name="add_service"),
    path(
        "services/<int:service_id>/edit/",
        views.edit_service_api,
        name="edit_service",
    ),
    path(
        "services/<int:service_id>/delete/",
        views.delete_service_api,
        name="delete_service",
    ),

    # APPOINTMENTS
    path("appointments/", views.appointments_api, name="appointments_api"),
    path(
        "appointments/<int:appointment_id>/edit/",
        views.edit_appointment_api,
        name="edit_appointment",
    ),
    path(
        "appointments/<int:appointment_id>/delete/",
        views.delete_appointment_api,
        name="delete_appointment",
    ),
    path(
        "appointments/<int:appointment_id>/status/",
        views.update_appointment_status_api,
        name="update_appointment_status",
    ),

    # PACKAGES
    path("packages/", views.packages_api, name="packages_api"),
    path(
        "packages/<int:package_id>/edit/",
        views.edit_package_api,
        name="edit_package",
    ),
    path(
        "packages/<int:package_id>/delete/",
        views.delete_package_api,
        name="delete_package",
    ),

    # CUSTOMER PACKAGE PURCHASES
    path(
        "customer-packages/",
        views.customer_packages_api,
        name="customer_packages_api",
    ),
    path(
        "customer-packages/<int:purchase_id>/",
        views.update_customer_package_api,
        name="update_customer_package_api",
    ),

    # BILLING
    path("bills/", views.bills_api, name="bills_api"),
    path(
        "bills/<int:bill_id>/update/",
        views.update_bill_api,
        name="update_bill",
    ),
    path(
        "bills/<int:bill_id>/delete/",
        views.delete_bill_api,
        name="delete_bill",
    ),
    
    # STAFF
    path("staff/", views.staff_api, name="staff_api"),


    path("reports/", reports_api, name="reports_api"),
    path("notifications/", notifications_api, name="notifications_api"),
    path("notifications/read-all/", mark_all_notifications_read_api, name="mark_all_notifications_read_api"),
    path("notifications/<int:notification_id>/read/", mark_notification_read_api, name="mark_notification_read_api"),
]
