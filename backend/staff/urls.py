
from django.urls import path
from . import views

urlpatterns = [
    path("", views.staff_list, name="staff-list"),
    path("<int:staff_id>/", views.staff_detail, name="staff-detail"),
]
