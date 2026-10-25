
from django.contrib import admin
from .models import Customer, Service, Appointment, Package


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'email', 'phone', 'created_at')
    search_fields = ('full_name', 'email', 'phone')


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'price',
        'duration_minutes',
        'is_active',
    )
    search_fields = ('name',)
    list_filter = ('is_active',)
    fields = (
        'name',
        'description',
        'price',
        'duration_minutes',
        'image_url',
        'is_active',
    )


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer',
        'service',
        'appointment_date',
        'appointment_time',
        'status',
    )
    list_filter = ('status', 'appointment_date')
    search_fields = ('customer__full_name', 'service__name')


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'price',
        'validity_days',
        'is_active',
    )
    search_fields = ('name',)
    list_filter = ('is_active',)
    filter_horizontal = ('services',)
