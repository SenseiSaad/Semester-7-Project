from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (AttendanceRecord, ClassSession, Course, Device, Enrollment,
                     Notification, User, Violation)

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Student signup: email + student ID + claim code from the roster."""
    claim_code = serializers.CharField(write_only=True, max_length=16)
    student_id = serializers.CharField(write_only=True, max_length=24)
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['email', 'name', 'student_id', 'claim_code', 'password']

    def validate_email(self, v):
        if User.objects.filter(email__iexact=v.strip()).exists():
            raise serializers.ValidationError('This email is already registered.')
        return v.strip().lower()

    def validate(self, attrs):
        code = attrs.get('claim_code', '').strip().upper()
        sid = attrs.get('student_id', '').strip().upper()
        enr = Enrollment.objects.filter(claim_code=code).select_related('course').first()
        if enr is None:
            raise serializers.ValidationError({'claim_code': 'Invalid claim code.'})
        if enr.claimed:
            raise serializers.ValidationError({'claim_code': 'This claim code was already used.'})
        if enr.student_id.upper() != sid:
            raise serializers.ValidationError(
                {'student_id': 'Student ID does not match this claim code.'})
        attrs['_enrollment'] = enr
        return attrs

    def create(self, validated):
        enr = validated.pop('_enrollment')
        validated.pop('claim_code')
        sid = validated.pop('student_id').strip().upper()
        user = User.objects.create_user(
            role=User.Role.STUDENT, student_id=sid, **validated)
        # claim the matching enrollment and any other roster rows for the same ID
        Enrollment.objects.filter(student_id=sid, claimed=False).update(
            user=user, claimed=True)
        enr.refresh_from_db()
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        'no_active_account': 'Wrong email or password.'
    }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role'] = self.user.role
        data['name'] = self.user.name
        data['device_registered'] = Device.objects.filter(student=self.user).exists()
        return data


class DeviceRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ['device_token']

    def validate_device_token(self, v):
        v = (v or '').strip()
        if not (8 <= len(v) <= 64):
            raise serializers.ValidationError('Invalid device token.')
        return v  # duplicate tokens are allowed; the scanner flags device sharing


class UserLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'student_id']


class CourseSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'name', 'code', 'teacher', 'teacher_name',
                  'eligibility_threshold', 'student_count', 'created_at']
        read_only_fields = ['teacher']

    def get_student_count(self, obj):
        return obj.enrollments.filter(claimed=True).count()

    def validate_code(self, v):
        return v.strip().upper()


class EnrollmentSerializer(serializers.ModelSerializer):
    has_device = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ['id', 'user', 'student_id', 'name', 'claim_code',
                  'claimed', 'has_device']
        read_only_fields = ['user', 'claimed', 'claim_code']

    def get_has_device(self, obj):
        return bool(obj.user_id) and Device.objects.filter(student=obj.user).exists()


class ClassSessionSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    present_count = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassSession
        fields = ['id', 'course', 'course_code', 'date', 'status',
                  'ip_check_enabled', 'present_count', 'enrolled_count', 'created_at']
        read_only_fields = ['status', 'secret']

    def get_present_count(self, obj):
        return obj.records.filter(status='present').count()

    def get_enrolled_count(self, obj):
        return obj.course.enrollments.filter(claimed=True).count()


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'student', 'student_name', 'student_id',
                  'status', 'method', 'marked_at', 'edited_by', 'edit_reason']


class ManualEditSerializer(serializers.ModelSerializer):
    """Teacher-only manual attendance edit; reason is mandatory (audited)."""
    reason = serializers.CharField(min_length=4, max_length=200, write_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['status', 'reason']

    def save(self, **kwargs):
        rec = self.instance
        rec.status = self.validated_data['status']
        rec.method = AttendanceRecord.Method.MANUAL
        rec.edited_by = self.context['request'].user
        rec.edit_reason = self.validated_data['reason']
        rec.save()
        return rec


class ViolationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    course_code = serializers.CharField(source='session.course.code', read_only=True)
    session_date = serializers.DateField(source='session.date', read_only=True)

    class Meta:
        model = Violation
        fields = ['id', 'student', 'student_name', 'student_id', 'course_code',
                  'session', 'session_date', 'type', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'read', 'created_at']


class ScanSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=200)
    device_token = serializers.CharField(max_length=64, allow_blank=True, required=False)
