
from django.db import models
from django.contrib.auth.hashers import make_password, check_password


class User(models.Model):

    ROLE_CHOICES = [
        ('admin', 'Admin/Owner'),
        ('receptionist', 'Receptionist'),
        ('stylist', 'Stylist/Beautician'),
        ('customer', 'Customer'),
    ]

    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    password = models.CharField(max_length=128)
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='customer'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def __str__(self):
        return f"{self.full_name} ({self.role})"
