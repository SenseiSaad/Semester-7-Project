"""Tests for the two security-critical areas: scan validation and eligibility,
plus permissions, registration, and manual-edit auditing."""
import secrets
from datetime import date, timedelta
from unittest import mock

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from . import services
from .models import (AttendanceRecord, ClassSession, Course, Device, Enrollment,
                     Notification, User, Violation)


def base(template, n=1):
    return template * n


class BaseSetUp(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.teacher = User.objects.create_user(
            email='t@uni.edu', password='teach1234', name='Teacher', role=User.Role.TEACHER)
        self.course = Course.objects.create(
            name='Discrete Mathematics', code='CS-301', teacher=self.teacher,
            eligibility_threshold=75)
        self.student = User.objects.create_user(
            email='s1@uni.edu', password='study1234', name='Student One',
            role=User.Role.STUDENT, student_id='2022-CS-001')
        self.enr = Enrollment.objects.create(
            course=self.course, user=self.student, student_id='2022-CS-001',
            name='Student One', claim_code='ABCD1234', claimed=True)
        self.other = User.objects.create_user(
            email='s2@uni.edu', password='study1234', name='Student Two',
            role=User.Role.STUDENT, student_id='2022-CS-002')
        Enrollment.objects.create(course=self.course, user=self.other,
                                  student_id='2022-CS-002', name='Student Two',
                                  claim_code='EEEE2222', claimed=True)
        self.session = ClassSession.objects.create(course=self.course, secret=secrets.token_hex(16))
        Device.objects.create(student=self.student, device_token='dev-token-1')
        Device.objects.create(student=self.other, device_token='dev-token-2')

    def login(self, user, password):
        res = self.api.post('/api/auth/token/', {'email': user.email, 'password': password})
        self.assertEqual(res.status_code, 200, res.content)
        self.api.credentials(HTTP_AUTHORIZATION='Bearer ' + res.data['access'])
        return res.data

    def code(self, session=None, rotation_offset=0, secret=None):
        session = session or self.session
        if secret is None:
            return services.sign(session, services.rotation_window() - rotation_offset * 20)
        msg = f'{session.id}:{services.rotation_window() - rotation_offset * 20}'
        import hashlib, hmac
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()[:32]
        return f'{session.id}.{services.rotation_window() - rotation_offset * 20}.{sig}'

    def scan(self, code=None, device='dev-token-1', client=None, ip='127.0.0.1'):
        client = client or self.api
        return client.post('/api/attendance/scan/',
                           {'code': code or self.code(), 'device_token': device},
                           REMOTE_ADDR=ip)


# ------------------------- eligibility -------------------------

class EligibilityTests(TestCase):
    def test_exact_threshold_is_eligible(self):
        e = services.eligibility(75, 100, 75)
        self.assertEqual(e['status'], 'eligible')
        self.assertEqual(e['percentage'], 75.0)

    def test_at_risk_band(self):
        self.assertEqual(services.eligibility(74, 100, 75)['status'], 'at_risk')
        self.assertEqual(services.eligibility(70, 100, 75)['status'], 'at_risk')
        self.assertEqual(services.eligibility(69.9, 100, 75)['status'], 'not_eligible')

    def test_not_eligible(self):
        self.assertEqual(services.eligibility(50, 100, 75)['status'], 'not_eligible')

    def test_custom_threshold_uses_band_of_5(self):
        e = services.eligibility(66, 100, 70)  # 66 >= 70-5
        self.assertEqual(e['status'], 'at_risk')
        self.assertEqual(services.eligibility(64.9, 100, 70)['status'], 'not_eligible')

    def test_no_data(self):
        e = services.eligibility(0, 0, 75)
        self.assertEqual(e['status'], 'no_data')
        self.assertIsNone(e['percentage'])

    def test_classes_needed_math(self):
        # present 17, held 24, thr 75 -> attend 4 in a row -> 21/28 = 75%
        e = services.eligibility(17, 24, 75)
        self.assertEqual(e['classes_needed'], 4)
        # simulation: attending exactly n classes reaches the threshold
        n = e['classes_needed']
        self.assertGreaterEqual((17 + n) / (24 + n), 0.75)
        self.assertLess((17 + n - 1) / (24 + n - 1), 0.75)

    def test_can_miss_math(self):
        # 23/24 at 75 -> can miss 6
        e = services.eligibility(23, 24, 75)
        self.assertEqual(e['can_miss'], 6)
        self.assertGreaterEqual(23 / (24 + 6), 0.75)
        self.assertLess(23 / (24 + 7), 0.75)
        self.assertEqual(services.eligibility(17, 24, 75)['can_miss'], 0)

    def test_eligible_student_has_zero_classes_needed(self):
        self.assertEqual(services.eligibility(23, 24, 75)['classes_needed'], 0)


# ------------------------- QR code signing -------------------------

class QRCodeTests(BaseSetUp):
    def test_current_code_verifies(self):
        self.assertTrue(services.verify_window(self.session, self.code())['ok'])

    def test_previous_window_accepted(self):
        self.assertTrue(services.verify_window(self.session, self.code(rotation_offset=1))['ok'])

    def test_two_windows_old_is_expired(self):
        self.assertEqual(services.verify_window(self.session, self.code(rotation_offset=2))['reason'],
                         'expired')

    def test_wrong_secret_is_invalid_not_expired(self):
        forged = self.code(secret='attacker-key-000000000000000')
        self.assertEqual(services.verify_window(self.session, forged)['reason'], 'invalid')

    def test_code_from_other_session_is_invalid(self):
        other = ClassSession.objects.create(course=self.course, secret=secrets.token_hex(16))
        code = services.sign(other, services.rotation_window())
        self.assertEqual(services.verify_window(self.session, code)['reason'], 'invalid')

    def test_garbage_codes(self):
        for junk in ['', 'abc', '1.2.3', f'{self.session.id}.{services.rotation_window()}.zzzz',
                     None, f'{self.session.id}:{services.rotation_window()}']:
            self.assertFalse(services.verify_window(self.session, junk)['ok'])


# ------------------------- scan validation -------------------------

class ScanTests(BaseSetUp):
    def setUp(self):
        super().setUp()
        self.login(self.student, 'study1234')

    def test_happy_path_marks_present(self):
        res = self.scan()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['status'], 'present')
        rec = AttendanceRecord.objects.get(session=self.session, student=self.student)
        self.assertEqual(rec.method, AttendanceRecord.Method.QR)

    def test_already_marked_is_not_a_penalty(self):
        self.scan()
        res = self.scan()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'already_marked')
        self.assertEqual(AttendanceRecord.objects.filter(session=self.session).count(), 1)

    def test_expired_code_rejected_without_violation(self):
        res = self.scan(code=self.code(rotation_offset=2))
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'expired')
        self.assertEqual(Violation.objects.count(), 0)

    def test_forged_code_rejected_without_violation(self):
        res = self.scan(code=self.code(secret='attacker-key-000000000000000'))
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'invalid')
        self.assertEqual(Violation.objects.count(), 0)

    def test_garbage_code_rejected(self):
        res = self.scan(code='hello-world')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Violation.objects.count(), 0)

    def test_closed_session_rejected(self):
        self.session.status = 'closed'
        self.session.save()
        res = self.scan()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'closed')
        self.assertEqual(AttendanceRecord.objects.count(), 0)

    def test_not_enrolled_rejected(self):
        outsider = User.objects.create_user(
            email='s3@uni.edu', password='study1234', name='Three',
            role=User.Role.STUDENT, student_id='2022-CS-003')
        Device.objects.create(student=outsider, device_token='dev-token-3')
        self.login(outsider, 'study1234')
        res = self.scan(device='dev-token-3', client=self.api)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'not_enrolled')
        self.assertEqual(Violation.objects.count(), 0)

    def test_unregistered_device_creates_violation(self):
        res = self.scan(device='somebody-elses-phone')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(res.data['violation'])
        self.assertEqual(Violation.objects.filter(
            student=self.student, type=Violation.Type.UNREGISTERED_DEVICE).count(), 1)
        # student got an in-app warning
        self.assertTrue(Notification.objects.filter(user=self.student).exists())

    def test_device_shared_by_second_account(self):
        # both accounts are registered to the same physical device token;
        # the FIRST account scans fine, the SECOND gets flagged
        Device.objects.update_or_create(student=self.other,
                                        defaults={'device_token': 'dev-token-1'})
        first = self.scan()
        self.assertEqual(first.status_code, 201, first.content)
        self.login(self.other, 'study1234')
        res = self.scan(device='dev-token-1', client=self.api)
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'device_shared')
        self.assertFalse(AttendanceRecord.objects.filter(student=self.other).exists())
        # the first student's legit record is untouched
        self.assertTrue(AttendanceRecord.objects.filter(student=self.student).exists())

    def test_second_violation_notifies_instructor(self):
        Device.objects.update_or_create(student=self.other,
                                        defaults={'device_token': 'dev-token-1'})
        # first violation for this student in this course
        Violation.objects.create(student=self.other, session=self.session,
                                 type=Violation.Type.UNREGISTERED_DEVICE)
        Notification.objects.all().delete()
        self.scan()  # the registered owner scans first
        self.login(self.other, 'study1234')
        self.scan(device='dev-token-1', client=self.api)  # second account, same device
        teacher_note = Notification.objects.filter(user=self.teacher)
        self.assertTrue(teacher_note.exists())
        self.assertIn('2nd', teacher_note.first().message)

    def test_ip_check_blocks_outside_campus(self):
        self.session.ip_check_enabled = True
        self.session.save()
        res = self.scan(ip='203.0.113.99')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'outside_campus')
        self.assertEqual(AttendanceRecord.objects.count(), 0)

    def test_ip_check_allows_campus_ip(self):
        self.session.ip_check_enabled = True
        self.session.save()
        res = self.scan(ip='10.5.5.20')
        self.assertEqual(res.status_code, 201, res.content)

    def test_scan_requires_auth(self):
        anon = APIClient()
        res = anon.post('/api/attendance/scan/', {'code': self.code()})
        self.assertEqual(res.status_code, 401)


# ------------------------- permissions -------------------------

class PermissionTests(BaseSetUp):
    def test_student_cannot_create_course_or_session(self):
        self.login(self.student, 'study1234')
        r1 = self.api.post('/api/courses/', {'name': 'X', 'code': 'X-1'})
        r2 = self.api.post('/api/sessions/', {'course': self.course.id})
        self.assertEqual(r1.status_code, 403)
        self.assertEqual(r2.status_code, 403)

    def test_student_cannot_see_eligibility_report(self):
        self.login(self.student, 'study1234')
        res = self.api.get(f'/api/courses/{self.course.id}/eligibility/')
        self.assertEqual(res.status_code, 403)

    def test_teacher_cannot_scan(self):
        self.login(self.teacher, 'teach1234')
        res = self.scan(client=self.api)
        self.assertEqual(res.status_code, 403)

    def test_other_teacher_cannot_touch_course(self):
        other_teacher = User.objects.create_user(
            email='t2@uni.edu', password='teach1234', name='T2', role=User.Role.TEACHER)
        self.login(other_teacher, 'teach1234')
        res = self.api.get(f'/api/courses/{self.course.id}/roster/')
        self.assertIn(res.status_code, (403, 404))

    def test_sessions_are_teacher_scoped(self):
        other_teacher = User.objects.create_user(
            email='t3@uni.edu', password='teach1234', name='T3', role=User.Role.TEACHER)
        other_course = Course.objects.create(name='B', code='CS-999', teacher=other_teacher)
        other_session = ClassSession.objects.create(course=other_course, secret='x' * 32)
        self.login(self.teacher, 'teach1234')
        res = self.api.get(f'/api/sessions/{other_session.id}/')
        self.assertEqual(res.status_code, 404)


# ------------------------- registration -------------------------

class RegistrationTests(BaseSetUp):
    def setUp(self):
        super().setUp()
        self.api = APIClient()

    def register(self, **over):
        payload = dict(email='new@uni.edu', name='New Kid',
                       student_id='2022-CS-009', claim_code='CLAIM0009', password='secret123')
        payload.update(over)
        return self.api.post('/api/auth/register/', payload)

    def test_signup_with_claim_code(self):
        Enrollment.objects.create(course=self.course, student_id='2022-CS-009',
                                  name='Imran Qureshi', claim_code='CLAIM0009')
        res = self.register()
        self.assertEqual(res.status_code, 201, res.content)
        enr = Enrollment.objects.get(claim_code='CLAIM0009')
        self.assertTrue(enr.claimed)
        self.assertEqual(enr.user.email, 'new@uni.edu')

    def test_claim_code_links_all_courses_of_same_student(self):
        c2 = Course.objects.create(name='B', code='CS-302', teacher=self.teacher)
        Enrollment.objects.create(course=self.course, student_id='2022-CS-009',
                                  name='Imran', claim_code='CLAIM0009')
        Enrollment.objects.create(course=c2, student_id='2022-CS-009',
                                  name='Imran', claim_code='CLAIM000B')
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertTrue(Enrollment.objects.get(claim_code='CLAIM000B').claimed)
        self.assertEqual(User.objects.get(email='new@uni.edu')
                         .enrollments.count(), 2)

    def test_wrong_claim_code_rejected(self):
        res = self.register(claim_code='NOPE0000')
        self.assertEqual(res.status_code, 400)
        self.assertIn('claim_code', res.data)

    def test_student_id_mismatch_rejected(self):
        Enrollment.objects.create(course=self.course, student_id='2022-CS-009',
                                  name='Imran', claim_code='CLAIM0009')
        res = self.register(student_id='2022-CS-042')
        self.assertEqual(res.status_code, 400)

    def test_reused_claim_code_rejected(self):
        Enrollment.objects.create(course=self.course, student_id='2022-CS-009',
                                  name='Imran', claim_code='CLAIM0009')
        self.register()
        res = self.register(email='again@uni.edu', name='Again')
        self.assertEqual(res.status_code, 400)

    def test_duplicate_email_rejected(self):
        Enrollment.objects.create(course=self.course, student_id='2022-CS-009',
                                  name='Imran', claim_code='CLAIM0009')
        res = self.register(email='s1@uni.edu', name='Dup')
        self.assertEqual(res.status_code, 400)


# ------------------------- manual editing / audit -------------------------

class ManualEditTests(BaseSetUp):
    def setUp(self):
        super().setUp()
        self.login(self.student, 'study1234')

    def test_manual_edit_requires_reason_and_audits(self):
        self.scan()  # student marked present by QR
        rec = AttendanceRecord.objects.get(session=self.session, student=self.student)
        self.login(self.teacher, 'teach1234')
        res = self.api.patch(f'/api/attendance/records/{rec.id}/',
                             {'status': 'absent', 'reason': 'no'})
        self.assertEqual(res.status_code, 400)  # reason too short

        res = self.api.patch(f'/api/attendance/records/{rec.id}/',
                             {'status': 'absent', 'reason': 'Seen leaving the hall'})
        self.assertEqual(res.status_code, 200, res.content)
        rec.refresh_from_db()
        self.assertEqual(rec.status, 'absent')
        self.assertEqual(rec.method, 'manual')
        self.assertEqual(rec.edited_by, self.teacher)
        self.assertEqual(rec.edit_reason, 'Seen leaving the hall')

    def test_manual_edit_frozen_after_close(self):
        self.scan()
        rec = AttendanceRecord.objects.get(session=self.session, student=self.student)
        self.session.status = 'closed'
        self.session.save()
        self.login(self.teacher, 'teach1234')
        res = self.api.patch(f'/api/attendance/records/{rec.id}/',
                             {'status': 'absent', 'reason': 'late change'})
        self.assertEqual(res.status_code, 400)

    def test_teacher_cannot_edit_other_course_record(self):
        self.scan()
        rec = AttendanceRecord.objects.get(session=self.session, student=self.student)
        t2 = User.objects.create_user(email='t9@uni.edu', password='teach1234',
                                      name='T9', role=User.Role.TEACHER)
        Course.objects.create(name='X', code='CS-888', teacher=t2)
        client = APIClient()
        client.post('/api/auth/token/', {'email': 't9@uni.edu', 'password': 'teach1234'})
        token = client.post('/api/auth/token/', {'email': 't9@uni.edu', 'password': 'teach1234'}).data['access']
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        res = client.patch(f'/api/attendance/records/{rec.id}/',
                           {'status': 'absent', 'reason': 'sabotage'})
        self.assertEqual(res.status_code, 404)


# ------------------------- roster import -------------------------

class RosterImportTests(BaseSetUp):
    def test_import_creates_enrollments_with_codes(self):
        self.login(self.teacher, 'teach1234')
        csv_text = 'student_id,name\n2022-CS-020,Test One\n2022-CS-021,Test Two\n'
        res = self.api.post(f'/api/courses/{self.course.id}/roster/',
                            {'csv': csv_text}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(res.data['created']), 2)
        codes = [c['claim_code'] for c in res.data['created']]
        self.assertTrue(all(len(c) == 8 for c in codes))

    def test_import_skips_duplicates_and_bad_rows(self):
        self.login(self.teacher, 'teach1234')
        csv_text = '2022-CS-001,Dup\n,\n2022-CS-022,Ok\n'
        res = self.api.post(f'/api/courses/{self.course.id}/roster/',
                            {'csv': csv_text}, format='json')
        self.assertEqual(len(res.data['created']), 1)
        self.assertEqual(len(res.data['skipped']), 1)  # blank rows are ignored silently

    def test_student_cannot_import(self):
        self.login(self.student, 'study1234')
        res = self.api.post(f'/api/courses/{self.course.id}/roster/', {'csv': 'a,b'})
        self.assertEqual(res.status_code, 403)


# ------------------------- student summary -------------------------

class SummaryTests(BaseSetUp):
    def test_summary_matches_eligibility_service(self):
        AttendanceRecord.objects.create(session=self.session, student=self.student,
                                        status='present')
        self.login(self.student, 'study1234')
        res = self.api.get('/api/me/summary/')
        self.assertEqual(res.status_code, 200)
        row = res.data['courses'][0]
        self.assertEqual(row['present'], 1)
        self.assertEqual(row['held'], 1)
        self.assertEqual(row['status'], 'eligible')

# ------------------------- public stats & session missing list -------------------------

class PublicStatsTests(TestCase):
    def setUp(self):
        BaseSetUp.setUp(self)

    def test_anonymous_stats_no_names(self):
        from rest_framework.test import APIClient as C
        res = C().get('/api/stats/')
        self.assertEqual(res.status_code, 200)
        for key in ('students', 'courses', 'sessions', 'records', 'avg'):
            self.assertIn(key, res.data)
        # aggregate numbers only — no personal data in the payload
        body = str(res.content)
        for name in ('Student One', 'Student Two', 's1@uni.edu', '2022-CS-001'):
            self.assertNotIn(name, body)


class SessionMissingTests(BaseSetUp):
    def test_missing_lists_unmarked_students(self):
        self.login(self.teacher, 'teach1234')
        res = self.api.get(f'/api/sessions/{self.session.id}/')
        missing_ids = [m['student_id'] for m in res.data['missing']]
        self.assertIn('2022-CS-001', missing_ids)
        self.assertIn('2022-CS-002', missing_ids)
        # one student scans → they leave the missing list
        self.login(self.student, 'study1234')
        self.scan()
        self.login(self.teacher, 'teach1234')
        res = self.api.get(f'/api/sessions/{self.session.id}/')
        missing_ids = [m['student_id'] for m in res.data['missing']]
        self.assertNotIn('2022-CS-001', missing_ids)
        self.assertIn('2022-CS-002', missing_ids)

    def test_eligibility_counts_in_response(self):
        AttendanceRecord.objects.create(session=self.session, student=self.student,
                                        status='present')
        self.login(self.teacher, 'teach1234')
        res = self.api.get(f'/api/courses/{self.course.id}/eligibility/')
        self.assertEqual(res.data['counts']['eligible'], 1)
        self.assertEqual(res.data['counts']['not_eligible'], 1)  # held>0, present 0
