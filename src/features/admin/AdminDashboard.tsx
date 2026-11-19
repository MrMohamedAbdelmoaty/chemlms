/**
 * Admin dashboard: overview stats, curriculum/grade/class management, user
 * management (create / edit / suspend / bulk CSV import), parent–student
 * linking, school-wide announcements with targeting, reports with CSV/PDF
 * export, audit log and school settings.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  adminResetPassword, announcementApi, attendanceApi, classApi, curriculumApi, exportCsv,
  gradebookApi, messageApi, settingsApi, usersApi,
} from '../../services/api';
import {
  Badge, Button, Card, EmptyState, Input, Modal, Select, StatCard, Table, THead, TRow, TD, Textarea,
} from '../../components/ui';
import { BarChart } from '../../components/charts';
import { Avatar } from '../../components/ui';
import type { Role, User } from '../../types';

export function AdminDashboard({ admin, view }: { admin: User; view: string }) {
  const { t } = useApp();
  const stats = useMemo(() => {
    const students = usersApi.list('student');
    const teachers = usersApi.list('teacher');
    const parents = usersApi.list('parent');
    const allAtt = Object.values(classApi.list().reduce<Record<string, number>>((acc, c) => {
      acc[c.id] = attendanceApi.classRate(c.id);
      return acc;
    }, {}));
    const grades = gradebookApi.forClass(classApi.list()[0]?.id ?? '');
    const avg = grades.filter((g) => g.score != null).length
      ? Math.round(grades.filter((g) => g.score != null).reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / grades.filter((g) => g.score != null).length)
      : 0;
    return {
      students: students.length, teachers: teachers.length, parents: parents.length,
      classes: classApi.list().length,
      attendance: allAtt.length ? Math.round(allAtt.reduce((a, b) => a + b, 0) / allAtt.length) : 0,
      avg,
    };
  }, []);

  switch (view) {
    case 'curricula':
      return <CurriculaView />;
    case 'users':
      return <UsersView admin={admin} />;
    case 'classes':
      return <ClassesView />;
    case 'announcements':
      return <AnnouncementsView admin={admin} />;
    case 'reports':
      return <ReportsView />;
    case 'audit':
      return <AuditView />;
    case 'settings':
      return <SettingsView />;
    default:
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t('students')} value={stats.students} icon="🎓" tone="blue" />
            <StatCard label={t('teachers')} value={stats.teachers} icon="🧑‍🏫" tone="violet" />
            <StatCard label={t('parents')} value={stats.parents} icon="👨‍👩‍👧" tone="amber" />
            <StatCard label={t('classesCount')} value={stats.classes} icon="📚" tone="green" />
            <StatCard label={t('attendanceRate')} value={`${stats.attendance}%`} icon="✅" tone="green" />
            <StatCard label={t('avgGrades')} value={`${stats.avg}%`} icon="📈" tone="blue" />
          </div>
          <Card title={t('academicYears')} subtitle={`${t('term')} · 2025–2026`}>
            <div className="grid gap-4 lg:grid-cols-3">
              {curriculumApi.list().map((c) => {
                const cls = classApi.list().filter((x) => x.curriculumId === c.id);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                      <Badge tone="blue">{c.code}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{c.examStyle}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.gradeIds.length} grades · {cls.length} classes · {cls.reduce((a, b) => a + b.studentIds.length, 0)} students</p>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title={t('timetable')} subtitle={t('exams') + ' & schedules'}>
            <div className="space-y-2 text-sm">
              {classApi.list().map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{c.name}</span>
                  <span className="text-xs text-slate-400">
                    {usersApi.byId(c.teacherId)?.name} · {c.studentIds.length} students · midterm {new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      );
  }
}

/* -------------------------------- curricula ------------------------------- */
function CurriculaView() {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ id: '', name: '', code: '', description: '', examStyle: '' });

  const save = () => {
    if (!d.name || !d.code) return toast('Name and code required', 'error');
    curriculumApi.save({ ...d, color: 'violet' });
    toast('Curriculum saved', 'success');
    setOpen(false);
    setD({ id: '', name: '', code: '', description: '', examStyle: '' });
  };

  return (
    <Card title={t('curricula')} subtitle="Configure curricula, grades, topics and learning outcomes"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('addCurriculum')}</Button>}>
      <div className="space-y-3">
        {curriculumApi.list().map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name} <Badge tone="blue">{c.code}</Badge></p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                <p className="mt-1 text-xs text-slate-400">Exam style: {c.examStyle} · {c.gradeIds.length} grades · {curriculumApi.topics(c.id).length} topics · {curriculumApi.outcomes(c.id).length} LOs</p>
              </div>
              <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => { curriculumApi.save({ ...c, color: c.color }); toast('Saved', 'success'); }}>{t('edit')}</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {curriculumApi.grades(c.id).map((g) => <Badge key={g.id} tone="slate">{g.name}</Badge>)}
            </div>
            <details className="mt-2">
              <summary className="text-xs font-medium text-brand-600 dark:text-brand-300 cursor-pointer">Topics & learning outcomes</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {curriculumApi.topics(c.id).map((tp) => (
                  <div key={tp.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/40">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tp.unit} · {tp.name}</p>
                    {curriculumApi.outcomes(c.id).filter((lo) => lo.topicId === tp.id).map((lo) => (
                      <p key={lo.id} className="text-[11px] text-slate-500 dark:text-slate-400">{lo.code}: {lo.text.slice(0, 60)}…</p>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('addCurriculum')}>
        <div className="space-y-3">
          <Input placeholder="Curriculum name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <Input placeholder="Code (e.g. STEM)" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />
          <Input placeholder="Exam style" value={d.examStyle} onChange={(e) => setD({ ...d, examStyle: e.target.value })} />
          <Textarea placeholder="Description" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* ---------------------------------- users --------------------------------- */
function UsersView({ admin }: { admin: User }) {
  const { t, toast } = useApp();
  const [role, setRole] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const users = usersApi.list(role === 'all' ? undefined : role)
    .filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const downloadCsvTemplate = () => {
    const csv = 'name,email,role\nJane Doe,jane@example.com,student\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card title={t('users')} subtitle={`${users.length} users`}
      action={
        <div className="flex gap-2">
          <Button className="h-9 px-3 text-xs" onClick={() => setLinkOpen(true)}>{t('linkParents')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={() => setImportOpen(true)}>{t('bulkImport')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={() => setAddOpen(true)}>+ {t('newUser')}</Button>
        </div>
      }>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value as Role | 'all')} className="w-44">
          <option value="all">{t('all')}</option>
          <option value="admin">{t('role_admin')}</option>
          <option value="teacher">{t('role_teacher')}</option>
          <option value="student">{t('role_student')}</option>
          <option value="parent">{t('role_parent')}</option>
        </Select>
        <Input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Role</th><th className="px-4 py-2 text-left">Email</th><th className="px-4 py-2 text-left">Phone</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {users.map((u) => (
            <TRow key={u.id}>
              <TD><div className="flex items-center gap-2"><Avatar name={u.name} color={u.avatarColor} size={28} /><span className="font-medium text-slate-800 dark:text-slate-100">{u.name}</span></div></TD>
              <TD><Badge tone={u.role === 'admin' ? 'blue' : u.role === 'teacher' ? 'violet' : u.role === 'student' ? 'green' : 'amber'}>{t(`role_${u.role}`)}</Badge></TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{u.email}{!u.emailConfirmed && <span className="ml-1 text-amber-500">⚠</span>}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{u.phone ?? '—'}{u.phone && !u.phoneConfirmed && <span className="ml-1 text-amber-500">⚠</span>}</TD>
              <TD>{u.status === 'active' ? <Badge tone="green">{t('active')}</Badge> : <Badge tone="red">{t('suspended')}</Badge>}</TD>
              <TD className="text-end">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit(u)}>{t('edit')}</Button>
                {u.role !== 'admin' && (
                  <Button variant="ghost" className="h-8 px-2 text-xs"
                    onClick={() => { usersApi.setStatus(u.id, u.status === 'active' ? 'suspended' : 'active'); toast('Status updated', 'success'); }}>
                    {u.status === 'active' ? t('suspended') : t('active')}
                  </Button>)}
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>

      {/* edit user + admin tools */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('edit') + ' — ' + (edit?.name ?? '')} wide>
        {edit && (
          <EditUserModal user={edit} onClose={() => setEdit(null)} />
        )}
      </Modal>

      {/* add user */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('newUser')}>
        <AddUserForm onDone={() => setAddOpen(false)} />
      </Modal>

      {/* bulk import */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('bulkImport')} wide>
        <BulkImportForm onDone={() => setImportOpen(false)} template={downloadCsvTemplate} />
      </Modal>

      {/* link parent to student */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title={t('linkParents')}>
        <LinkParentForm onDone={() => setLinkOpen(false)} />
      </Modal>
    </Card>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const { t, toast } = useApp();
  const [d, setD] = useState({ name: '', email: '', phone: '', role: 'student' as Role, password: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!d.name || !d.email) return toast('Name and email required', 'error');
    if (d.password && d.password.length < 6) return toast('Password must be at least 6 characters', 'error');
    setBusy(true);
    await usersApi.create(d);
    setBusy(false);
    toast('User added', 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <Input placeholder={t('newUser') + ' — name'} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      <Input placeholder="Email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
      <Input placeholder="Phone (optional, e.g. +201000000000)" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
      <Select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as Role })}>
        <option value="student">{t('role_student')}</option>
        <option value="teacher">{t('role_teacher')}</option>
        <option value="parent">{t('role_parent')}</option>
      </Select>
      <Input placeholder="Password (min 6 chars)" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('cancel')}</Button>
        <Button onClick={save} disabled={busy}>{busy ? '…' : t('save')}</Button>
      </div>
    </div>
  );
}

function BulkImportForm({ onDone, template }: { onDone: () => void; template: () => void }) {
  const { t, toast } = useApp();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const n = await usersApi.bulkImport(csv);
    setBusy(false);
    toast(`${n} users imported`, 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <div>
        <Textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="name,email,role&#10;Jane Doe,jane@example.com,student" />
      </div>
      <Button variant="outline" className="h-9 px-3 text-xs" onClick={template}>Download CSV template</Button>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('cancel')}</Button>
        <Button onClick={save} disabled={busy}>{busy ? '…' : t('save')}</Button>
      </div>
    </div>
  );
}

function LinkParentForm({ onDone }: { onDone: () => void }) {
  const { t, toast } = useApp();
  const parents = usersApi.list('parent');
  const students = usersApi.list('student');
  const [parentId, setParentId] = useState(parents[0]?.id ?? '');
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const link = () => {
    usersApi.linkParentStudent(parentId, studentId);
    toast('Parent linked', 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
        {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('cancel')}</Button>
        <Button onClick={link}>{t('save')}</Button>
      </div>
    </div>
  );
}

/**
 * EditUserModal — full admin control over a single user:
 * edit name/email/phone, confirm email/phone, reset password, delete account.
 */
function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { t, toast } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [resetPw, setResetPw] = useState('');
  const [confirmToken, setConfirmToken] = useState('');
  const [busy, setBusy] = useState(false);

  const saveProfile = () => {
    usersApi.update(user.id, { name, email, phone: phone || undefined });
    toast('Profile updated', 'success');
  };

  const doConfirm = (target: 'email' | 'phone') => {
    const token = target === 'email' ? confirmToken : confirmToken;
    if (target === 'email') {
      const res = usersApi.confirm(user.id, 'email', user.id);
      if (res.ok) toast('Email confirmed', 'success');
      else toast(res.error ?? 'Failed', 'error');
    } else {
      if (!user.phone) { toast('User has no phone number', 'error'); return; }
      const res = usersApi.confirm(user.id, 'phone', user.id);
      if (res.ok) toast('Phone confirmed', 'success');
      else toast(res.error ?? 'Failed', 'error');
    }
  };

  const resend = (target: 'email' | 'phone') => {
    const res = usersApi.resendConfirmation(user.id, target);
    if ('token' in res) {
      setConfirmToken(res.token);
      toast(`New ${target} confirmation code: ${res.token}`, 'info');
    } else toast(res.error, 'error');
  };

  const doReset = async () => {
    if (resetPw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setBusy(true);
    const res = await adminResetPassword(user.id, resetPw, user.id);
    setBusy(false);
    if (res.ok) { toast('Password reset — new password set', 'success'); setResetPw(''); }
    else toast(res.error ?? 'Failed', 'error');
  };

  const doDelete = () => {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    usersApi.remove(user.id, user.id);
    toast('User deleted', 'success');
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* profile */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Profile</h3>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (e.g. +201000000000)" />
        <Button onClick={saveProfile}>{t('save')}</Button>
      </div>

      {/* confirmation */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Verification</h3>
        <div className="flex items-center gap-2">
          <Badge tone={user.emailConfirmed ? 'green' : 'amber'}>Email: {user.emailConfirmed ? 'Confirmed' : 'Unconfirmed'}</Badge>
          <Badge tone={user.phoneConfirmed ? 'green' : 'amber'}>Phone: {user.phoneConfirmed ? 'Confirmed' : 'Unconfirmed'}</Badge>
        </div>
        <Input value={confirmToken} onChange={(e) => setConfirmToken(e.target.value)} placeholder="Confirmation code" className="font-mono" />
        <div className="flex flex-wrap gap-2">
          {!user.emailConfirmed && <>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => resend('email')}>Resend email code</Button>
            <Button className="h-8 px-3 text-xs" onClick={() => doConfirm('email')}>Confirm email</Button>
          </>}
          {user.phone && !user.phoneConfirmed && <>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => resend('phone')}>Resend phone code</Button>
            <Button className="h-8 px-3 text-xs" onClick={() => doConfirm('phone')}>Confirm phone</Button>
          </>}
        </div>
      </div>

      {/* password reset */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reset password</h3>
        <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password (min 6 chars)" />
        <Button onClick={doReset} disabled={busy}>{busy ? '…' : 'Reset password'}</Button>
      </div>

      {/* danger */}
      <div className="space-y-2 border-t border-rose-200 pt-3 dark:border-rose-900">
        <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Danger zone</h3>
        <Button variant="danger" onClick={doDelete}>Delete account</Button>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
      </div>
    </div>
  );
}

/* ---------------------------------- classes ------------------------------- */
function ClassesView() {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const teachers = usersApi.list('teacher');
  const grades = curriculumApi.list().flatMap((c) => curriculumApi.grades(c.id).map((g) => ({ ...g, curriculumName: c.name })));
  const [d, setD] = useState({ name: '', gradeId: '', teacherId: '', curriculumId: '' });

  const save = () => {
    if (!d.name) return toast('Name required', 'error');
    const grade = grades.find((g) => g.id === d.gradeId);
    classApi.save({ ...d, curriculumId: grade?.curriculumId ?? curriculumApi.list()[0].id });
    toast('Class saved', 'success');
    setOpen(false);
  };

  return (
    <Card title={t('classes')} subtitle="Classes & sections across curricula"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('addClass')}</Button>}>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Curriculum</th><th className="px-4 py-2 text-left">Teacher</th><th className="px-4 py-2 text-left">Students</th><th className="px-4 py-2 text-left">{t('attendanceRate')}</th></tr></THead>
        <tbody>
          {classApi.list().map((c) => (
            <TRow key={c.id}>
              <TD className="font-medium text-slate-800 dark:text-slate-100">{c.name}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{curriculumApi.list().find((x) => x.id === c.curriculumId)?.name}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{usersApi.byId(c.teacherId)?.name}</TD>
              <TD>{c.studentIds.length}</TD>
              <TD><Badge tone="green">{attendanceApi.classRate(c.id)}%</Badge></TD>
            </TRow>
          ))}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title={t('addClass')}>
        <div className="space-y-3">
          <Input placeholder="Class name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <Select value={d.gradeId} onChange={(e) => setD({ ...d, gradeId: e.target.value })}>
            <option value="">Grade…</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.curriculumName})</option>)}
          </Select>
          <Select value={d.teacherId} onChange={(e) => setD({ ...d, teacherId: e.target.value })}>
            <option value="">Teacher…</option>
            {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.name}</option>)}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* -------------------------------- announcements ---------------------------- */
function AnnouncementsView({ admin }: { admin: User }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ title: '', body: '', roles: [] as Role[], gradeIds: [] as string[], classIds: [] as string[] });

  const post = () => {
    if (!d.title || !d.body) return toast('Title and body required', 'error');
    announcementApi.post(d, admin.id);
    toast('Announcement posted', 'success');
    setOpen(false);
    setD({ title: '', body: '', roles: [], gradeIds: [], classIds: [] });
  };

  const toggle = <K extends 'roles' | 'gradeIds' | 'classIds'>(key: K, value: string) => {
    const arr = d[key] as string[];
    setD({ ...d, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] });
  };

  const allGrades = curriculumApi.list().flatMap((c) => curriculumApi.grades(c.id));

  return (
    <Card title={t('announcements')} subtitle="School-wide announcements — target by role, grade or class"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('postAnnouncement')}</Button>}>
      <div className="space-y-2">
        {[...announcementApi.visibleFor(admin)].sort((a, b) => b.at.localeCompare(a.at)).map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
              <Badge tone="slate">{new Date(a.at).toLocaleDateString()}</Badge>
              {a.targets.roles.map((r) => <Badge key={r} tone="blue">{t(`role_${r}`)}</Badge>)}
              {a.targets.gradeIds.map((g) => <Badge key={g} tone="violet">{allGrades.find((x) => x.id === g)?.name ?? g}</Badge>)}
              {a.targets.classIds.map((c) => <Badge key={c} tone="green">{classApi.byId(c)?.name ?? c}</Badge>)}
              {a.targets.roles.length === 0 && a.targets.classIds.length === 0 && <Badge tone="slate">{t('all')}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.body}</p>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('postAnnouncement')} wide>
        <div className="space-y-3">
          <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <Textarea rows={3} placeholder="Message" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('targetRoles')}</p>
            <div className="flex gap-2">
              {(['student', 'teacher', 'parent'] as Role[]).map((r) => (
                <button key={r} onClick={() => toggle('roles', r)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${d.roles.includes(r) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {t(`role_${r}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('targetGrades')}</p>
            <div className="flex flex-wrap gap-2">
              {allGrades.map((g) => (
                <button key={g.id} onClick={() => toggle('gradeIds', g.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${d.gradeIds.includes(g.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('targetClasses')}</p>
            <div className="flex flex-wrap gap-2">
              {classApi.list().map((c) => (
                <button key={c.id} onClick={() => toggle('classIds', c.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${d.classIds.includes(c.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={post}>{t('postAnnouncement')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* ---------------------------------- reports -------------------------------- */
function ReportsView() {
  const { t } = useApp();
  const classes = classApi.list();
  const [scope, setScope] = useState('all');

  const download = (name: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const gradesCsv = () => {
    const rows: (string | number)[][] = [['student', 'class', 'assessment', 'type', 'score', 'max', 'date']];
    for (const c of classes) {
      for (const g of gradebookApi.forClass(c.id)) {
        rows.push([usersApi.byId(g.studentId)?.name ?? '', c.name, g.title, g.type, g.score ?? '', g.maxScore, g.date]);
      }
    }
    download('grades.csv', exportCsv(rows));
  };

  const attendanceCsv = () => {
    const rows: (string | number)[][] = [['student', 'class', 'date', 'status']];
    for (const c of classes) {
      for (const a of usersApi.list('student').flatMap((s) => c.studentIds.includes(s.id) ? attendanceApi.forStudent(s.id) : [])) {
        rows.push([usersApi.byId(a.studentId)?.name ?? '', c.name, a.date, a.status]);
      }
    }
    download('attendance.csv', exportCsv(rows));
  };

  const classCsv = () => {
    const rows: (string | number)[][] = [['class', 'curriculum', 'teacher', 'students', 'attendance %', 'avg grade %']];
    for (const c of classes) {
      const g = gradebookApi.forClass(c.id).filter((x) => x.score != null);
      const avg = g.length ? Math.round(g.reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / g.length) : 0;
      rows.push([c.name, curriculumApi.list().find((x) => x.id === c.curriculumId)?.name ?? '', usersApi.byId(c.teacherId)?.name ?? '', c.studentIds.length, attendanceApi.classRate(c.id), avg]);
    }
    download('performance-by-class.csv', exportCsv(rows));
  };

  const curriculumData = curriculumApi.list().map((c) => {
    const cls = classes.filter((x) => x.curriculumId === c.id);
    const g = cls.flatMap((x) => gradebookApi.forClass(x.id)).filter((y) => y.score != null);
    return {
      label: c.code,
      value: g.length ? Math.round(g.reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / g.length) : 0,
    };
  });

  return (
    <div className="space-y-4">
      <Card title={t('reports')} subtitle="Grades, attendance and performance — export CSV or print PDF">
        <div className="no-print flex flex-wrap gap-2">
          <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-44">
            <option value="all">{t('all')} classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button className="h-9 px-3 text-xs" onClick={gradesCsv}>{t('exportCsv')} — {t('grades')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={attendanceCsv}>{t('exportCsv')} — {t('attendance')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={classCsv}>{t('exportCsv')} — {t('analytics')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={() => window.print()}>{t('exportPdf')}</Button>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Average grade by curriculum</p>
          <BarChart data={curriculumData} color="#10b981" />
        </div>
      </Card>

      <Card title={t('grades')} subtitle={t('readOnly')}>
        <div className="print-page overflow-x-auto">
          <Table>
            <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Assessment</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Score</th></tr></THead>
            <tbody>
              {classes.filter((c) => scope === 'all' || c.id === scope).map((c) =>
                gradebookApi.forClass(c.id).map((g) => (
                  <TRow key={g.id}>
                    <TD>{usersApi.byId(g.studentId)?.name}</TD>
                    <TD>{c.name}</TD>
                    <TD>{g.title}</TD>
                    <TD className="text-xs capitalize text-slate-500 dark:text-slate-400">{g.type}</TD>
                    <TD className="text-xs text-slate-500 dark:text-slate-400">{g.date}</TD>
                    <TD>{g.score == null ? '—' : `${g.score}/${g.maxScore}`}</TD>
                  </TRow>
                )))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------- audit --------------------------------- */
function AuditView() {
  const { t } = useApp();
  const logs = settingsApi.auditLogs();
  void t;
  return (
    <>
    <Card title={t('auditLog')} subtitle={`${logs.length} events`}>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2 text-left">Actor</th><th className="px-4 py-2 text-left">Action</th><th className="px-4 py-2 text-left">Detail</th></tr></THead>
        <tbody>
          {logs.map((l) => (
            <TRow key={l.id}>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(l.at).toLocaleString()}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{usersApi.byId(l.actorId)?.name ?? l.actorId}</TD>
              <TD><Badge tone="slate">{l.action}</Badge></TD>
              <TD className="text-xs text-slate-600 dark:text-slate-300">{l.detail}</TD>
            </TRow>
          ))}
        </tbody>
      </Table>
    </Card>
    <div className="mt-4"><MessageModeration /></div>
    </>
  );
}

/* ---------------------------------- settings ------------------------------- */
function SettingsView() {
  const { t, toast } = useApp();
  const s = settingsApi.get();
  const [d, setD] = useState({ ...s });
  const [importOpen, setImportOpen] = useState(false);

  return (
    <Card title={t('schoolSettings')}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('logo')}</span>
            <Input value={d.logoText} onChange={(e) => setD({ ...d, logoText: e.target.value })} maxLength={4} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">School name</span>
            <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('primaryColor')}</span>
            <Select value={d.primaryColor} onChange={(e) => setD({ ...d, primaryColor: e.target.value as typeof d.primaryColor })}>
              <option value="indigo">Indigo</option>
              <option value="teal">Teal</option>
              <option value="amber">Amber</option>
              <option value="rose">Rose</option>
            </Select>
          </label>
          <Button onClick={() => { settingsApi.update(d); toast('Settings saved', 'success'); }}>{t('save')}</Button>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Brand preview</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">{d.logoText}</div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{d.name}</span>
            </div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-900/15">
            <p className="text-sm font-semibold text-rose-700">Demo data</p>
            <p className="mt-1 text-xs text-rose-600/80">Reset the in-memory database to its seeded demo state.</p>
            <Button variant="danger" className="mt-2 h-8 px-3 text-xs" onClick={() => { settingsApi.resetDemo(); toast('Demo data reset', 'success'); }}>Reset demo data</Button>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Button variant="outline" className="h-9 px-3 text-xs" onClick={() => setImportOpen(true)}>{t('bulkImport')}</Button>
      </div>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('bulkImport')}>
        <p className="text-sm text-slate-500">Use the Users page for bulk CSV import of users.</p>
      </Modal>
    </Card>
  );
}

/* --------------------------- message moderation --------------------------- */
function MessageModeration() {
  const { t } = useApp();
  const msgs = messageApi.all().slice(0, 10);
  return (
    <Card title={t('moderation')} subtitle="All messaging is logged and visible to Admin (read-only)">
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2 text-left">From</th><th className="px-4 py-2 text-left">To</th><th className="px-4 py-2 text-left">Message</th></tr></THead>
        <tbody>
          {msgs.map((m) => (
            <TRow key={m.id}>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(m.at).toLocaleString()}</TD>
              <TD className="text-xs text-slate-600 dark:text-slate-300">{usersApi.byId(m.fromId)?.name}</TD>
              <TD className="text-xs text-slate-600 dark:text-slate-300">{usersApi.byId(m.toId)?.name}</TD>
              <TD className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{m.content}</TD>
            </TRow>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
