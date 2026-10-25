
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("api/public-booking/", include("salon.public_booking_urls")),
    path("admin/", admin.site.urls),
    path("api/users/", include("users.urls")),
    path("api/salon/", include("salon.urls")),
     path("api/staff/", include("staff.urls")),
]
