from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required')
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('role', User.Role.TEACHER)
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Single user table; role separates teacher (admin/instructor) from student."""

    class Role(models.TextChoices):
        TEACHER = 'teacher', 'Teacher'
        STUDENT = 'student', 'Student'

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=80)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    # students only; teachers leave it empty
    student_id = models.CharField(max_length=24, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.name} ({self.role})'

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT


class Device(models.Model):
    """The one device a student may scan from; teacher can reset (delete) it.
    device_token is NOT unique on purpose: if two students register the same
    token, that IS the device-sharing attack and the scanner reports it."""
    student = models.OneToOneField(User, on_delete=models.CASCADE, related_name='device')
    device_token = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'Device of {self.student.name}'


class Course(models.Model):
    name = models.CharField(max_length=80)
    code = models.CharField(max_length=20, unique=True)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses')
    eligibility_threshold = models.PositiveSmallIntegerField(
        default=75, validators=[MinValueValidator(1), MaxValueValidator(99)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.name}'


class Enrollment(models.Model):
    """One row per roster line. Unclaimed until the student registers with the claim code."""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    # filled once the student signs up; before that the roster row is anonymous.
    # (named `user` because `student` + the `student_id` column would clash in Django)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments',
                             null=True, blank=True)
    student_id = models.CharField(max_length=24)
    name = models.CharField(max_length=80)
    claim_code = models.CharField(max_length=16, unique=True)
    claimed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('course', 'student_id')]
        ordering = ['student_id']

    def __str__(self):
        return f'{self.student_id} in {self.course.code}'


class ClassSession(models.Model):
    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        CLOSED = 'closed', 'Closed'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sessions')
    date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=6, choices=Status.choices, default=Status.OPEN)
    secret = models.CharField(max_length=64)  # HMAC key for this session's QR codes
    ip_check_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.course.code} session #{self.id} ({self.status})'


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT = 'absent', 'Absent'

    class Method(models.TextChoices):
        QR = 'qr', 'QR scan'
        MANUAL = 'manual', 'Manual entry/edit'

    session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    status = models.CharField(max_length=7, choices=Status.choices)
    method = models.CharField(max_length=6, choices=Method.choices, default=Method.QR)
    marked_at = models.DateTimeField(auto_now_add=True)
    # audit trail for manual edits
    edited_by = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='edited_records',
                                  null=True, blank=True)
    edit_reason = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [('session', 'student')]
        ordering = ['marked_at']

    def __str__(self):
        return f'{self.student.name} {self.status} @ session {self.session_id}'


class Violation(models.Model):
    class Type(models.TextChoices):
        DEVICE_SHARED = 'device_shared', 'Device used by a second account in the same session'
        UNREGISTERED_DEVICE = 'unregistered_device', 'Scan from an unregistered device'

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='violations')
    session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='violations')
    type = models.CharField(max_length=20, choices=Type.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def course(self):
        return self.session.course

    def __str__(self):
        return f'{self.student.name}: {self.type} @ session {self.session_id}'


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=240)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'To {self.user.name}: {self.message[:40]}'
