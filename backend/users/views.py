
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
from django.core import signing
from django.views.decorators.http import require_POST
from django.db import transaction

from .models import User
from salon.models import Customer


@csrf_exempt
@require_POST
def register_user(request):
    try:
        data = json.loads(request.body)

        full_name = data.get("full_name", "").strip()
        email = data.get("email", "").strip().lower()
        phone = data.get("phone", "").strip()
        password = data.get("password", "")
        address = data.get("address", "").strip()

        if not all([full_name, email, phone, password]):
            return JsonResponse(
                {"message": "All fields are required."},
                status=400
            )

        if len(password) < 8:
            return JsonResponse(
                {"message": "Password must be at least 8 characters."},
                status=400
            )

        if User.objects.filter(email=email).exists():
            return JsonResponse(
                {"message": "Email is already registered."},
                status=409
            )

        with transaction.atomic():
            user = User(
                full_name=full_name,
                email=email,
                phone=phone,
                role="customer",
                is_active=True
            )
            user.password = make_password(password)
            user.save()

            customer, created = Customer.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "phone": phone,
                    "address": address
                }
            )

            # Update existing customer details if this email already exists.
            if not created:
                customer.full_name = full_name
                customer.phone = phone
                if address:
                    customer.address = address
                customer.save()

        return JsonResponse({
            "message": "Registration successful.",
            "user": {
                "id": user.id,
                "customer_id": customer.id,
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse(
            {"message": "Invalid JSON data."},
            status=400
        )

    except Exception as e:
        print("Registration error:", repr(e))
        return JsonResponse(
            {"message": "Something went wrong during registration."},
            status=500
        )


@csrf_exempt
@require_POST
def login_user(request):
    try:
        data = json.loads(request.body)

        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        selected_role = data.get("role", "").strip().lower()

        if not email or not password:
            return JsonResponse(
                {"message": "Email and password are required."},
                status=400
            )

        if selected_role not in [
            "customer", "admin", "receptionist", "stylist"
        ]:
            return JsonResponse(
                {"message": "Please select a valid role."},
                status=400
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse(
                {"message": "Invalid email or password."},
                status=401
            )

        if not user.is_active:
            return JsonResponse(
                {"message": "Your account is inactive."},
                status=403
            )

        if not check_password(password, user.password):
            return JsonResponse(
                {"message": "Invalid email or password."},
                status=401
            )

        if user.role != selected_role:
            return JsonResponse(
                {"message": "Selected role does not match this account."},
                status=403
            )

        customer_id = None

        if user.role == "customer":
            with transaction.atomic():
                customer, created = Customer.objects.get_or_create(
                    email=user.email,
                    defaults={
                        "full_name": user.full_name,
                        "phone": user.phone,
                        "address": ""
                    }
                )

                if not created:
                    changed = False

                    if not customer.full_name:
                        customer.full_name = user.full_name
                        changed = True

                    if not customer.phone:
                        customer.phone = user.phone
                        changed = True

                    if changed:
                        customer.save()

                customer_id = customer.id

        return JsonResponse({
            "message": "Login successful.",
            "user": {
                "id": user.id,
                "customer_id": customer_id,
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "token": signing.dumps({"uid": user.pk}, salt="salon-api-auth"),
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse(
            {"message": "Invalid JSON data."},
            status=400
        )

    except Exception as e:
        print("Login error:", repr(e))
        return JsonResponse(
            {"message": "Something went wrong during login."},
            status=500
        )
