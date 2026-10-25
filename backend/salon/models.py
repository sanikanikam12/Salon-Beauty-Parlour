
from django.db import models


class Customer(models.Model):
    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    preferences = models.TextField(blank=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class Service(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_minutes = models.PositiveIntegerField(default=30)
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Appointment(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="appointments"
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="appointments"
    )

    # Selected staff member / beautician
    staff = models.ForeignKey(
        "salon.Staff",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="appointments"
    )

    appointment_date = models.DateField()
    appointment_time = models.TimeField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.customer.full_name} - {self.appointment_date}"


class Package(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    services = models.ManyToManyField(
        Service,
        related_name="packages",
        blank=True
    )

    price = models.DecimalField(max_digits=10, decimal_places=2)
    validity_days = models.PositiveIntegerField(default=30)
    included_visits = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustomerPackage(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("expired", "Expired"),
    ]

    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="purchased_packages"
    )

    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="customer_purchases"
    )

    purchase_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="pending"
    )

    remaining_visits = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.customer.full_name} - {self.package.name}"


class Bill(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("card", "Card"),
        ("online", "Online"),
    ]

    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="bills"
    )

    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bills"
    )

    # Final amount payable after discount and applicable charges.
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    # Nullable so old bills remain identifiable without inventing their subtotal.
    subtotal_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    additional_charges = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default="cash"
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="pending"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Bill #{self.id} - {self.customer.full_name}"


class Staff(models.Model):
    ROLE_CHOICES = [
        ("stylist", "Stylist"),
        ("receptionist", "Receptionist"),
        ("manager", "Manager"),
    ]

    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="stylist"
    )

    specializations = models.TextField(blank=True)
    working_days = models.CharField(max_length=100, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name

class Notification(models.Model):
    TYPE_CHOICES = [
        ("appointment", "Appointment"),
        ("payment", "Payment"),
        ("membership", "Membership"),
        ("system", "System"),
    ]

    notification_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default="system",
        db_index=True,
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    related_id = models.CharField(max_length=100, blank=True, db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class AuditLog(models.Model):
    ENTITY_CHOICES = [
        ("appointment", "Appointment"),
        ("bill", "Bill"),
        ("membership", "Membership"),
        ("customer", "Customer"),
    ]

    entity_type = models.CharField(max_length=30, choices=ENTITY_CHOICES, db_index=True)
    entity_id = models.CharField(max_length=64, db_index=True)
    action = models.CharField(max_length=64)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    actor_email = models.EmailField(blank=True)
    actor_role = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.entity_type} #{self.entity_id}: {self.action}"


class LoyaltyTransaction(models.Model):
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="loyalty_transactions"
    )
    bill = models.OneToOneField(
        Bill, on_delete=models.CASCADE, related_name="loyalty_transaction"
    )
    points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.customer.full_name}: {self.points} loyalty points"
