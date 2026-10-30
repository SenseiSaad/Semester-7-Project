from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # auth
    path('auth/register/', views.RegisterView.as_view()),
    path('auth/token/', views.LoginView.as_view()),
    path('auth/token/refresh/', TokenRefreshView.as_view()),
    path('auth/me/', views.me),
    path('devices/register/', views.register_device),

    # courses (teacher)
    path('courses/', views.CourseViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('courses/<int:course_id>/roster/', views.roster),
    path('courses/<int:course_id>/reset-device/', views.reset_device),
    path('courses/<int:course_id>/eligibility/', views.eligibility_report),

    # sessions (teacher)
    path('sessions/', views.SessionViewSet.as_view({'post': 'create', 'get': 'list'})),
    path('sessions/<int:session_id>/', views.session_detail),
    path('sessions/<int:session_id>/qr/', views.session_qr),
    path('sessions/<int:session_id>/close/', views.session_close),
    path('sessions/<int:session_id>/records/', views.session_records),

    # attendance
    path('attendance/scan/', views.attendance_scan),
    path('attendance/history/', views.attendance_history),
    path('attendance/records/<int:record_id>/', views.edit_record),
    path('attendance/records/', views.create_record),

    # violations & notifications
    path('violations/', views.violations_log),
    path('notifications/', views.notifications),
    path('notifications/<int:nid>/read/', views.notification_read),

    # student dashboard
    path('me/summary/', views.student_summary),
]
