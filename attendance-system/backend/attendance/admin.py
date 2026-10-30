from django.contrib import admin

from .models import (AttendanceRecord, ClassSession, Course, Device, Enrollment,
                     Notification, User, Violation)

admin.site.register(User)
admin.site.register(Device)
admin.site.register(Course)
admin.site.register(Enrollment)
admin.site.register(ClassSession)
admin.site.register(AttendanceRecord)
admin.site.register(Violation)
admin.site.register(Notification)
