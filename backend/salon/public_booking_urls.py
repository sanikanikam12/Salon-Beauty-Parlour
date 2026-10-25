from django.urls import path
from .advanced_features import public_booking_options, public_book_appointment

urlpatterns = [
    path("options/", public_booking_options, name="public-booking-options"),
    path("book/", public_book_appointment, name="public-book-appointment"),
]
