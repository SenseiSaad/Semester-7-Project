"""One-command demo data: teacher, 3 courses, students, history, an open session.

Run:  python manage.py seed_demo
Safe to re-run (idempotent).
"""
import secrets
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.models import (AttendanceRecord, ClassSession, Course, Device,
                               Enrollment, User)
from attendance.services import make_code


class Command(BaseCommand):
    help = 'Seed demo teacher, courses, roster, attendance history.'

    def handle(self, *args, **options):
        teacher, _ = User.objects.get_or_create(
            email='teacher@uni.edu',
            defaults=dict(name='Dr. Ayesha Khan', role=User.Role.TEACHER))
        teacher.set_password('teach1234')
        teacher.role = User.Role.TEACHER
        teacher.save()

        courses = {}
        for code, name, thr in [('CS-301', 'Discrete Mathematics', 75),
                                ('CS-302', 'Data Structures', 75),
                                ('CS-303', 'Database Systems', 70)]:
            course, created = Course.objects.get_or_create(
                code=code, defaults=dict(name=name, teacher=teacher,
                                         eligibility_threshold=thr))
            if created:
                course.name, course.teacher, course.eligibility_threshold = name, teacher, thr
                course.save()
            courses[code] = course

        # 10 roster rows per course; 8 students exist, 2 rows stay unclaimed
        # so the signup flow can be demoed with a real claim code.
        existing = [('2022-CS-001', 'Ahmed Raza'), ('2022-CS-002', 'Fatima Zahra'),
                    ('2022-CS-003', 'Muhammad Bilal'), ('2022-CS-004', 'Ayesha Siddiqui'),
                    ('2022-CS-005', 'Usman Ghani'), ('2022-CS-006', 'Hira Naz'),
                    ('2022-CS-007', 'Ali Hamza'), ('2022-CS-008', 'Zainab Tariq')]
        ghost = [('2022-CS-009', 'Imran Qureshi'), ('2022-CS-010', 'Kamran Shah')]

        users = {}
        for sid, name in existing:
            email = f'{sid.lower()}@uni.edu'
            u, created = User.objects.get_or_create(
                email=email, defaults=dict(name=name, role=User.Role.STUDENT, student_id=sid))
            if created:
                u.set_password('study1234')
                u.save()
            users[sid] = u
            if created or not Device.objects.filter(student=u).exists():
                Device.objects.get_or_create(student=u, defaults={
                    'device_token': secrets.token_hex(16)})

        for code, course in courses.items():
            for sid, name in existing + ghost:
                enr, created = Enrollment.objects.get_or_create(
                    course=course, student_id=sid,
                    defaults=dict(name=name, claim_code=secrets.token_hex(4).upper()))
                # real students get claimed rows; the two ghost rows stay
                # unclaimed so signup can be demoed with their claim codes
                if enr.user is None and sid in users:
                    enr.user, enr.claimed = users[sid], True
                    enr.save(update_fields=['user', 'claimed'])

        # attendance history with a deliberate spread
        #            Ahmed  Fatima Bilal  Ayesha Usman  Hira   Ali    Zainab
        plan = {'CS-301': ([.96, .90, .85, .80, .76, .73, .70, .55], 12),
                'CS-302': ([.90, .85, .82, .78, .74, .70, .60, .45], 8),
                'CS-303': ([.95, .88, .84, .79, .75, .72, .68, .50], 12)}
        for code, (ratios, n) in plan.items():
            course = courses[code]
            enrolled = list(course.enrollments.filter(
                user__isnull=False).order_by('student_id'))
            # top up closed sessions until we have n
            closed = list(course.sessions.filter(status=ClassSession.Status.CLOSED)
                          .order_by('date', 'id'))
            for k in range(len(closed), n):
                day = timezone.localdate() - timedelta(days=n - k)
                s = ClassSession.objects.create(
                    course=course, date=day, secret=secrets.token_hex(16),
                    status=ClassSession.Status.CLOSED)
                closed.append(s)
            # fill any closed session that has no records yet
            for k, session in enumerate(closed[:n]):
                if session.records.exists():
                    continue
                for enr, r in zip(enrolled, ratios):
                    absent_on = ((k * 7 + int(enr.student_id[-3:]) * 3) % n) < round(n * (1 - r))
                    AttendanceRecord.objects.create(
                        session=session, student=enr.user,
                        status='absent' if absent_on else 'present',
                        method=AttendanceRecord.Method.QR)

        # one open session in CS-301 so the teacher screen has something to show
        course = courses['CS-301']
        if not course.sessions.filter(status=ClassSession.Status.OPEN).exists():
            s = ClassSession.objects.create(course=course, secret=secrets.token_hex(16))
            self.stdout.write(self.style.SUCCESS(
                f'Open session #{s.id} — current QR code: {make_code(s)}'))
        # mid-class state: first six students already scanned
        open_session = course.sessions.filter(status=ClassSession.Status.OPEN).first()
        if open_session and not open_session.records.exists():
            for enr in course.enrollments.filter(user__isnull=False).order_by('student_id')[:6]:
                AttendanceRecord.objects.create(
                    session=open_session, student=enr.user,
                    status='present', method=AttendanceRecord.Method.QR)

        self.stdout.write(self.style.SUCCESS('\n=== DEMO LOGINS ==='))
        self.stdout.write('Teacher  teacher@uni.edu  / teach1234')
        self.stdout.write('Student  2022-cs-001@uni.edu / study1234  (…through …008)')
        self.stdout.write('\n=== UNCLAIMED ROSTER ROWS (use on the signup page) ===')
        for code, course in courses.items():
            for enr in course.enrollments.filter(claimed=False):
                self.stdout.write(f'{course.code}: id={enr.student_id} code={enr.claim_code}')
        self.stdout.write(self.style.SUCCESS('\nDone.'))
