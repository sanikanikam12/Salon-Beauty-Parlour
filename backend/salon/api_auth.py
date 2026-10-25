import re

from django.core import signing
from django.http import JsonResponse


class SalonApiAuthenticationMiddleware:
    """
    Require a signed, time-limited login token for salon/staff APIs.
    Role and email are read from the database, never from client headers.
    """

    TOKEN_SALT = "salon-api-auth"
    TOKEN_MAX_AGE = 8 * 60 * 60
    STAFF_ROLES = {"admin", "receptionist"}
    READ_METHODS = {"GET", "HEAD", "OPTIONS"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if request.method == "OPTIONS":
            return self.get_response(request)

        if not (
            path.startswith("/api/salon/")
            or path.startswith("/api/staff/")
        ):
            return self.get_response(request)

        header = request.headers.get("Authorization", "")
        parts = header.split(None, 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JsonResponse(
                {"error": "Authentication required. Please log in again."},
                status=401,
            )

        try:
            payload = signing.loads(
                parts[1],
                salt=self.TOKEN_SALT,
                max_age=self.TOKEN_MAX_AGE,
            )
            user_id = payload.get("uid")
            if not user_id:
                raise signing.BadSignature("Missing user id")

            from users.models import User
            user = User.objects.filter(
                pk=user_id, is_active=True
            ).first()

            if user is None:
                raise signing.BadSignature("Inactive or missing user")

        except (signing.BadSignature, signing.SignatureExpired,
                ValueError, TypeError, AttributeError):
            return JsonResponse(
                {"error": "Login token is invalid or expired. Please log in again."},
                status=401,
            )

        # Trusted server-side identity for API views.
        request.salon_api_user = user
        role = user.role
        clean_path = path.rstrip("/")
        method = request.method.upper()
        staff_roles = self.STAFF_ROLES

        def forbidden(message="You do not have permission to perform this action."):
            return JsonResponse({"error": message}, status=403)

        # Reports and bills contain business/financial information.
        if (
            clean_path == "/api/salon/reports"
            or clean_path == "/api/salon/bills"
            or clean_path.startswith("/api/salon/bills/")
        ) and role not in staff_roles:
            return forbidden()

        # Customer directory and modifications are staff-only.
        if clean_path.startswith("/api/salon/customers"):
            history = re.fullmatch(
                r"/api/salon/customers/(\d+)/history", clean_path
            )
            if history:
                if role not in staff_roles:
                    if role != "customer":
                        return forbidden()
                    from salon.models import Customer
                    owns_record = Customer.objects.filter(
                        pk=history.group(1),
                        email__iexact=user.email,
                    ).exists()
                    if not owns_record:
                        return forbidden("You can only view your own customer history.")
            elif role not in staff_roles:
                return forbidden()

        # Service and package catalog may be read by logged-in users;
        # modifications are restricted to admin/receptionist.
        for prefix in ("/api/salon/services", "/api/salon/packages"):
            if clean_path == prefix:
                if method not in self.READ_METHODS and role not in staff_roles:
                    return forbidden()
            elif clean_path.startswith(prefix + "/"):
                if role not in staff_roles:
                    return forbidden()

        # Appointment editing, deletion and status changes are staff-only.
        if re.fullmatch(
            r"/api/salon/appointments/\d+/(edit|delete|status)", clean_path
        ) and role not in staff_roles:
            return forbidden()

        # Staff schedule: authenticated users can read the schedule;
        # admin/receptionist can update it.
        if clean_path == "/api/salon/staff":
            if method not in self.READ_METHODS and role not in staff_roles:
                return forbidden()

        # The legacy staff directory includes staff management details.
        if clean_path.startswith("/api/staff"):
            if role not in {"admin", "receptionist", "stylist"}:
                return forbidden()
            if method not in self.READ_METHODS and role != "admin":
                return forbidden("Only an admin can modify staff records.")

        return self.get_response(request)
