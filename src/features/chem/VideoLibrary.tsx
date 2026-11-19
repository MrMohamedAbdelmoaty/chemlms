/**
 * Video library — upload, play and manage videos.
 *
 * Videos are uploaded as base64 data URLs and stored in the Supabase store
 * (via videosApi), so they are permanent and survive reloads. Admins and
 * teachers can upload and delete; students can watch. Videos can optionally
 * be linked to a course or lesson.
 */
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { courseApi, videosApi } from '../../services/api';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import type { Video } from '../../types';

const MAX_MB = 8; // pragmatic cap for base64 storage in the JSON store

/** Read a File into a base64 data URL (for permanent storage in Supabase). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VideoLibrary({ teacher }: { teacher?: boolean }) {
  const { user, toast } = useApp();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';
  const [videos, setVideos] = useState<Video[]>(() => videosApi.list());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playing, setPlaying] = useState<Video | null>(null);

  const refresh = () => setVideos(videosApi.list());

  const remove = (v: Video) => {
    if (!confirm(`Delete video "${v.title}"?`)) return;
    videosApi.remove(v.id, user?.id ?? 'u-admin');
    toast('Video deleted', 'success');
    refresh();
  };

  return (
    <Card title="Video Library" subtitle={`${videos.length} videos — uploaded and stored permanently`}
      action={canManage ? <Button className="h-9 px-3 text-xs" onClick={() => setUploadOpen(true)}>+ Upload video</Button> : undefined}>
      {videos.length === 0 ? (
        <EmptyState>{canManage ? 'No videos yet — upload one to get started.' : 'No videos available yet.'}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <video
                src={v.dataUrl} controls preload="metadata"
                className="aspect-video w-full bg-slate-900"
              />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{v.title}</p>
                  <Badge tone="blue">{v.category}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{v.description || 'No description'}</p>
                <p className="mt-1 text-[10px] text-slate-400">{(v.sizeBytes / 1024 / 1024).toFixed(1)} MB · {new Date(v.at).toLocaleDateString()}</p>
                <div className="mt-2 flex gap-2">
                  <Button className="h-8 px-3 text-xs" onClick={() => setPlaying(v)}>Watch</Button>
                  {canManage && <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => remove(v)}>Delete</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* upload modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload video" wide>
        <UploadForm onDone={() => { setUploadOpen(false); refresh(); }} teacher={teacher} />
      </Modal>

      {/* player modal */}
      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title ?? ''} wide>
        {playing && (
          <div className="space-y-3">
            <video src={playing.dataUrl} controls autoPlay className="aspect-video w-full rounded-lg bg-slate-900" />
            {playing.description && <p className="text-sm text-slate-600 dark:text-slate-300">{playing.description}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

/** Upload form — file picker, metadata, and conversion to a permanent data URL. */
export function UploadForm({ onDone, teacher }: { onDone: () => void; teacher?: boolean }) {
  const { user, toast } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const courses = courseApi.list();

  const pick = (f: File | null) => {
    setFile(f);
    setDataUrl('');
    if (!title && f) setTitle(f.name.replace(/\.[^.]+$/, ''));
    if (f && f.size > MAX_MB * 1024 * 1024) {
      toast(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — the cap is ${MAX_MB} MB for permanent storage.`, 'error');
    }
  };

  const upload = async () => {
    if (!file) return toast('Choose a video file first', 'error');
    if (file.size > MAX_MB * 1024 * 1024) return toast(`File exceeds the ${MAX_MB} MB cap`, 'error');
    setBusy(true);
    try {
      const url = await readAsDataUrl(file);
      setDataUrl(url);
      const v = videosApi.save({
        title: title || file.name,
        description,
        category,
        courseId: courseId || undefined,
        lessonId: lessonId || undefined,
        dataUrl: url,
        sizeBytes: file.size,
        mimeType: file.type,
      }, user?.id ?? 'u-admin');
      toast(`"${v.title}" uploaded and stored permanently`, 'success');
      onDone();
    } catch (e) {
      toast('Upload failed — try a smaller file', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Video file" hint={`Max ${MAX_MB} MB. Stored permanently in Supabase.`}>
        <input
          type="file" accept="video/*"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
        />
      </Field>
      {dataUrl && <Badge tone="green">Ready to upload — {file?.name}</Badge>}
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea rows={2} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Titration" />
        </Field>
        {courses.length > 0 && (
          <Field label="Link to course (optional)">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— none —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {courseId && (
        <Field label="Link to lesson (optional)">
          <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value="">— none —</option>
            {courseApi.lessons(courseId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </Select>
        </Field>
      )}
      {teacher && <p className="text-xs text-slate-400">Teachers can upload and manage videos for their courses.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={upload} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Button>
      </div>
    </div>
  );
}
