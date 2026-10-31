"""All API views. Permissions are explicit on every endpoint."""
import csv
import io
import secrets
import time
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from . import services
from .models import (AttendanceRecord, ClassSession, Course, Device, Enrollment,
                     Notification, User, Violation)
from .permissions import IsStudent, IsTeacher, IsTeacherOfCourse
from .serializers import (AttendanceRecordSerializer, ClassSessionSerializer,
                          CourseSerializer, DeviceRegisterSerializer,
                          EmailTokenObtainPairSerializer, EnrollmentSerializer,
                          ManualEditSerializer, NotificationSerializer,
                          RegisterSerializer, ScanSerializer, UserLiteSerializer,
                          ViolationSerializer)


def _csv_cell(v):
    s = '' if v is None else str(v)
    if s and s[0] in '=+-@':
        s = "'" + s  # spreadsheet formula-injection guard
    if any(c in s for c in ',"\n\r'):
        s = '"' + s.replace('"', '""') + '"'
    return s


# ============================ auth ============================

class RegisterView(generics.CreateAPIView):
    """Public student signup with a roster claim code."""
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


@api_view(['GET'])
def me(request):
    data = UserLiteSerializer(request.user).data
    data['device_registered'] = Device.objects.filter(student=request.user).exists()
    return Response(data)


@api_view(['POST'])
@permission_classes([IsStudent])
def register_device(request):
    ser = DeviceRegisterSerializer(data=request.data, context={'request': request})
    ser.is_valid(raise_exception=True)
    dev, created = Device.objects.update_or_create(
        student=request.user, defaults={'device_token': ser.validated_data['device_token']})
    return Response({'ok': True, 'created': created})


# ============================ courses (teacher) ============================

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        return Course.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)


def _course_eligibility_rows(course, search=''):
    rows = []
    for enr in course.enrollments.all():
        if not enr.claimed or enr.user is None:
            continue
        if search and search.lower() not in enr.name.lower() and search.lower() not in enr.student_id.lower():
            continue
        held = course.sessions.count()
        present = AttendanceRecord.objects.filter(
            session__course=course, student=enr.user, status='present').count()
        stats = services.eligibility(present, held, course.eligibility_threshold)
        rows.append({
            'enrollment_id': enr.id, 'student_id': enr.student_id, 'name': enr.name,
            'email': enr.user.email, 'has_device': Device.objects.filter(student=enr.user).exists(),
            'present': present, 'held': held, **stats,
        })
    rows.sort(key=lambda r: r['percentage'] if r['percentage'] is not None else -1)
    return rows


@api_view(['GET', 'POST'])
@permission_classes([IsTeacher])
def roster(request, course_id):
    course = Course.objects.filter(id=course_id, teacher=request.user).first()
    if course is None:
        return Response({'detail': 'Course not found.'}, status=404)

    if request.method == 'POST':
        # roster CSV: student_id,name(,email) — header optional, skipped automatically
        raw = ''
        if 'file' in request.FILES:
            raw = request.FILES['file'].read().decode('utf-8-sig', errors='replace')
        elif isinstance(request.data.get('csv'), str):
            raw = request.data['csv']
        if not raw.strip():
            return Response({'detail': 'Upload a CSV file or paste CSV text.'}, status=400)
        created, skipped, seen = [], [], set()
        for i, row in enumerate(csv.reader(io.StringIO(raw))):
            if not row or not any(c.strip() for c in row):
                continue
            sid = (row[0] or '').strip().upper()
            name = (row[1] if len(row) > 1 else '').strip() or sid
            if i == 0 and (sid.lower() in ('student_id', 'student id', 'roll', 'roll_no') or not sid):
                continue  # header
            if not sid or len(sid) > 24 or len(name) > 80:
                skipped.append({'row': i + 1, 'reason': 'invalid student_id or name'})
                continue
            if sid in seen:
                skipped.append({'row': i + 1, 'reason': f'duplicate {sid} in file'})
                continue
            seen.add(sid)
            if Enrollment.objects.filter(course=course, student_id=sid).exists():
                skipped.append({'row': i + 1, 'reason': f'{sid} already on roster'})
                continue
            # roster rows for already-registered students are linked immediately
            existing_user = User.objects.filter(student_id=sid, role=User.Role.STUDENT).first()
            enr = Enrollment.objects.create(
                course=course, student_id=sid, name=name,
                claim_code=secrets.token_hex(4).upper(),
                user=existing_user, claimed=existing_user is not None)
            created.append(EnrollmentSerializer(enr).data)
        return Response({'created': created, 'skipped': skipped}, status=201)

    q = (request.query_params.get('q') or '').strip()
    enrs = course.enrollments.all()
    if q:
        enrs = enrs.filter(Q(name__icontains=q) | Q(student_id__icontains=q))
    return Response({'course': CourseSerializer(course).data,
                     'roster': EnrollmentSerializer(enrs, many=True).data})


@api_view(['POST'])
@permission_classes([IsTeacher])
def reset_device(request, course_id):
    course = Course.objects.filter(id=course_id, teacher=request.user).first()
    enr = course and course.enrollments.filter(
        id=request.data.get('enrollment_id'), claimed=True).first()
    if not enr:
        return Response({'detail': 'Student not found on this roster.'}, status=404)
    deleted, _ = Device.objects.filter(student=enr.user).delete()
    return Response({'ok': True, 'reset': bool(deleted)})


@api_view(['GET'])
@permission_classes([IsTeacher])
def eligibility_report(request, course_id):
    course = Course.objects.filter(id=course_id, teacher=request.user).first()
    if course is None:
        return Response({'detail': 'Course not found.'}, status=404)
    rows = _course_eligibility_rows(course, search=request.query_params.get('q', ''))
    counts = {'eligible': 0, 'at_risk': 0, 'not_eligible': 0, 'no_data': 0}
    for r in rows:
        counts[r['status']] = counts.get(r['status'], 0) + 1
    status_filter = request.query_params.get('status')
    if status_filter:
        rows = [r for r in rows if r['status'] == status_filter]

    if request.query_params.get('format') == 'csv':
        head = ['Student ID', 'Name', 'Email', 'Present', 'Sessions held',
                'Percentage', 'Status', 'Classes needed', 'Can still miss']
        lines = [','.join(_csv_cell(h) for h in head)]
        lines += [','.join(_csv_cell(r[k]) for k in
                           ['student_id', 'name', 'email', 'present', 'held',
                            'percentage', 'status', 'classes_needed', 'can_miss'])
                  for r in rows]
        resp = HttpResponse('\r\n'.join(lines), content_type='text/csv')
        resp['Content-Disposition'] = f'attachment; filename="{quote(course.code)}-eligibility.csv"'
        return resp

    return Response({'course': CourseSerializer(course).data, 'rows': rows,
                     'counts': counts,
                     'threshold': course.eligibility_threshold})


# ============================ sessions (teacher) ============================

class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = ClassSessionSerializer
    permission_classes = [IsTeacher, IsTeacherOfCourse]

    def get_queryset(self):
        qs = ClassSession.objects.all()
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs.filter(course__teacher=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        course = Course.objects.filter(id=request.data.get('course'),
                                       teacher=request.user).first()
        if not course:
            return Response({'detail': 'Course not found.'}, status=404)
        open_existing = ClassSession.objects.filter(
            course=course, status=ClassSession.Status.OPEN).first()
        if open_existing:
            return Response({'detail': 'This course already has an open session.',
                             'session': ClassSessionSerializer(open_existing).data}, status=409)
        session = ClassSession.objects.create(course=course, secret=secrets.token_hex(16))
        return Response(ClassSessionSerializer(session).data, status=201)


@api_view(['GET'])
@permission_classes([IsTeacher])
def session_qr(request, session_id):
    """Signed code for the current 20s rotation window; teacher screen polls this."""
    session = ClassSession.objects.filter(
        id=session_id, course__teacher=request.user).select_related('course').first()
    if not session:
        return Response({'detail': 'Session not found.'}, status=404)
    if session.status != ClassSession.Status.OPEN:
        return Response({'detail': 'Session is closed.'}, status=400)
    code = services.make_code(session)
    step = settings.QR_ROTATION_SECONDS
    return Response({
        'code': code,
        'url': f'/attend?c={quote(code)}',
        'rotation_seconds': step,
        'valid_for': step - int(time.time()) % step,
    })


@api_view(['GET'])
@permission_classes([IsTeacher])
def session_detail(request, session_id):
    session = ClassSession.objects.filter(
        id=session_id, course__teacher=request.user).select_related('course').first()
    if not session:
        return Response({'detail': 'Session not found.'}, status=404)
    records = AttendanceRecordSerializer(
        session.records.select_related('student'), many=True).data
    present = sum(1 for r in records if r['status'] == 'present')
    # who hasn't been marked at all — the teacher chases these during class
    marked = {r['student'] for r in records}
    missing = [{'enrollment_id': e.id, 'name': e.name, 'student_id': e.student_id}
               for e in session.course.enrollments.filter(claimed=True).select_related('user')
               if e.user_id not in marked]
    return Response({'session': ClassSessionSerializer(session).data,
                     'present': present,
                     'enrolled': session.course.enrollments.filter(claimed=True).count(),
                     'records': records,
                     'missing': missing})


@api_view(['POST'])
@permission_classes([IsTeacher])
def session_close(request, session_id):
    session = ClassSession.objects.filter(
        id=session_id, course__teacher=request.user).first()
    if not session:
        return Response({'detail': 'Session not found.'}, status=404)
    session.status = ClassSession.Status.CLOSED
    session.save(update_fields=['status'])
    return Response(ClassSessionSerializer(session).data)


# ============================ attendance ============================

def _violation(student, session, vtype):
    """Log a violation, warn the student in-app, and tell the instructor on the 2nd."""
    Violation.objects.create(student=student, session=session, type=vtype)
    Notification.objects.create(
        user=student,
        message=f'⚠️ Attendance violation in {session.course.code}: '
                f'{Violation.Type(vtype).label}. Further violations are reported to your instructor.')
    n = Violation.objects.filter(student=student, session__course=session.course).count()
    if n == 2:
        Notification.objects.create(
            user=session.course.teacher,
            message=f'🚨 {student.name} ({student.student_id}) committed their 2nd '
                    f'violation in {session.course.code}. Check the violations log.')


@api_view(['POST'])
@permission_classes([IsStudent])
def attendance_scan(request):
    """The guarded gate. Order matters: forged/expired codes are plain rejections;
    only device mismatches create violations."""
    ser = ScanSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    code = ser.validated_data['code']
    device_token = (ser.validated_data.get('device_token') or '').strip()

    parsed = services.parse_code(code)
    session = ClassSession.objects.select_related('course').filter(
        id=parsed[0] if parsed else -1).first()
    if session is None:
        return Response({'detail': 'Invalid QR code.', 'reason': 'invalid'}, status=400)

    check = services.verify_window(session, code)
    if not check['ok']:
        if check['expired']:
            # expired but genuine code: reject, NO violation
            return Response({'detail': 'QR code expired — scan the current code on the teacher screen.',
                             'reason': 'expired'}, status=400)
        return Response({'detail': 'Invalid QR code.', 'reason': 'invalid'}, status=400)

    if session.status != ClassSession.Status.OPEN:
        return Response({'detail': 'This session is closed.', 'reason': 'closed'}, status=400)

    enrolled = Enrollment.objects.filter(
        course=session.course, user=request.user, claimed=True).exists()
    if not enrolled:
        return Response({'detail': 'You are not enrolled in this course.',
                         'reason': 'not_enrolled'}, status=400)

    # --- device checks: these create violations ---
    try:
        device = request.user.device
    except Device.DoesNotExist:
        _violation(request.user, session, Violation.Type.UNREGISTERED_DEVICE)
        return Response({'detail': 'No registered device. Log in on your own phone first.',
                         'reason': 'unregistered_device', 'violation': True}, status=403)
    if not device_token or device.device_token != device_token:
        _violation(request.user, session, Violation.Type.UNREGISTERED_DEVICE)
        return Response({'detail': 'Scan from your registered device only.',
                         'reason': 'unregistered_device', 'violation': True}, status=403)
    others = Device.objects.filter(device_token=device.device_token).exclude(student=request.user)
    if others.exists() and AttendanceRecord.objects.filter(
            session=session, student__in=others.values('student')).exists():
        _violation(request.user, session, Violation.Type.DEVICE_SHARED)
        return Response({'detail': 'This device was already used by another account in this session.',
                         'reason': 'device_shared', 'violation': True}, status=403)

    # --- optional campus IP check ---
    if session.ip_check_enabled:
        ip = request.META.get('REMOTE_ADDR', '')
        if not any(ip.startswith(p) for p in settings.CAMPUS_IP_PREFIXES):
            return Response({'detail': 'Campus network required for this session.',
                             'reason': 'outside_campus'}, status=400)

    rec, created = AttendanceRecord.objects.get_or_create(
        session=session, student=request.user,
        defaults={'status': 'present', 'method': AttendanceRecord.Method.QR})
    if not created:
        return Response({'detail': 'Already marked present for this session. No penalty.',
                         'status': 'already_marked'}, status=200)
    return Response({'detail': f'Marked present in {session.course.code}.',
                     'status': 'present'}, status=201)


@api_view(['GET'])
@permission_classes([IsStudent])
def attendance_history(request):
    records = (AttendanceRecord.objects.filter(student=request.user)
               .select_related('session', 'session__course').order_by('-marked_at'))
    data = AttendanceRecordSerializer(records, many=True).data
    return Response({'records': data})


@api_view(['GET'])
@permission_classes([IsTeacher])
def session_records(request, session_id):
    session = ClassSession.objects.filter(
        id=session_id, course__teacher=request.user).select_related('course').first()
    if not session:
        return Response({'detail': 'Session not found.'}, status=404)
    enrolled = session.course.enrollments.filter(claimed=True).select_related('user')
    marks = {r.student.student_id: r for r in session.records.select_related('student')}
    rows = []
    for enr in enrolled:
        rec = marks.get(enr.student_id)
        rows.append({
            'record_id': rec.id if rec else None,
            'enrollment_id': enr.id,
            'student_id': enr.student_id,
            'name': enr.name,
            'status': rec.status if rec else 'unmarked',
            'method': rec.method if rec else None,
            'edit_reason': rec.edit_reason if rec else '',
        })
    return Response({'session': ClassSessionSerializer(session).data, 'rows': rows})


@api_view(['PATCH'])
@permission_classes([IsTeacher])
def edit_record(request, record_id):
    rec = (AttendanceRecord.objects.filter(id=record_id)
           .select_related('session', 'session__course').first())
    if not rec or rec.session.course.teacher_id != request.user.id:
        return Response({'detail': 'Record not found.'}, status=404)
    if rec.session.status != ClassSession.Status.OPEN:
        return Response({'detail': 'Session is closed — records are frozen.'}, status=400)
    ser = ManualEditSerializer(rec, data=request.data, context={'request': request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(AttendanceRecordSerializer(rec).data)


@api_view(['POST'])
@permission_classes([IsTeacher])
def create_record(request):
    """Manual entry for a student who has no record in an open session."""
    session = ClassSession.objects.filter(
        id=request.data.get('session'), course__teacher=request.user).first()
    if not session:
        return Response({'detail': 'Session not found.'}, status=404)
    if session.status != ClassSession.Status.OPEN:
        return Response({'detail': 'Session is closed — records are frozen.'}, status=400)
    enr = session.course.enrollments.filter(
        id=request.data.get('enrollment_id'), claimed=True).first()
    if not enr:
        return Response({'detail': 'Student not found on this roster.'}, status=404)
    reason = (request.data.get('reason') or '').strip()
    if len(reason) < 4:
        return Response({'detail': 'A reason is required for manual entries.'}, status=400)
    if not request.data.get('status') in ('present', 'absent'):
        return Response({'detail': 'Status must be present or absent.'}, status=400)
    rec, created = AttendanceRecord.objects.get_or_create(
        session=session, student=enr.user,
        defaults={'status': request.data['status'],
                  'method': AttendanceRecord.Method.MANUAL,
                  'edited_by': request.user, 'edit_reason': reason})
    if not created:
        return Response({'detail': 'Record already exists — edit it instead.'}, status=409)
    return Response(AttendanceRecordSerializer(rec).data, status=201)


# ============================ violations / notifications / student ============================

@api_view(['GET'])
@permission_classes([IsTeacher])
def violations_log(request):
    qs = Violation.objects.select_related('student', 'session', 'session__course')
    course_id = request.query_params.get('course')
    if course_id:
        qs = qs.filter(session__course_id=course_id, session__course__teacher=request.user)
    else:
        qs = qs.filter(session__course__teacher=request.user)
    return Response({'violations': ViolationSerializer(qs[:200], many=True).data})


@api_view(['GET'])
@permission_classes([AllowAny])
def public_stats(request):
    """Aggregate numbers for the public landing page. No names, no per-student data."""
    pcts = []
    for enr in (Enrollment.objects.filter(claimed=True, user__isnull=False)
                .select_related('course')):
        held = enr.course.sessions.count()
        if held:
            present = AttendanceRecord.objects.filter(
                session__course=enr.course, student=enr.user, status='present').count()
            pcts.append(present / held * 100)
    return Response({
        'students': User.objects.filter(role=User.Role.STUDENT).count(),
        'courses': Course.objects.count(),
        'sessions': ClassSession.objects.count(),
        'records': AttendanceRecord.objects.count(),
        'avg': round(sum(pcts) / len(pcts), 1) if pcts else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications(request):
    qs = request.user.notifications.all()
    return Response({'notifications': NotificationSerializer(qs[:50], many=True).data,
                     'unread': qs.filter(read=False).count()})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_read(request, nid):
    n = request.user.notifications.filter(id=nid).first()
    if not n:
        return Response({'detail': 'Not found.'}, status=404)
    n.read = True
    n.save(update_fields=['read'])
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsStudent])
def student_summary(request):
    """Everything the student dashboard needs, in one call."""
    courses = []
    for enr in request.user.enrollments.filter(claimed=True).select_related('course'):
        course = enr.course
        held = course.sessions.count()
        present = AttendanceRecord.objects.filter(
            session__course=course, student=request.user, status='present').count()
        stats = services.eligibility(present, held, course.eligibility_threshold)
        courses.append({
            'course_id': course.id, 'name': course.name, 'code': course.code,
            'threshold': course.eligibility_threshold,
            'present': present, 'held': held, **stats,
        })
    return Response({'courses': courses})
