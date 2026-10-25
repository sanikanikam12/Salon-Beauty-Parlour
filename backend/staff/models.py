from django.db import models


class StaffMember(models.Model):
    ROLE_CHOICES = [
        ("Beautician", "Beautician"),
        ("Hair Stylist", "Hair Stylist"),
        ("Receptionist", "Receptionist"),
        ("Manager", "Manager"),
    ]

    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    email = models.EmailField(blank=True, default="")
    salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    working_hours = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name