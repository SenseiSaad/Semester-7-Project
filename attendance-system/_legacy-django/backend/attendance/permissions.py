from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_teacher)


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_student)


class IsTeacherOfCourse(BasePermission):
    """Object-level: teacher may only touch their own courses' data."""

    def has_object_permission(self, request, view, obj):
        course = obj if hasattr(obj, 'teacher') else getattr(obj, 'course', None)
        return bool(course and course.teacher_id == request.user.id)
