/**
 * Video library — upload, play and manage videos.
 *
 * Files are uploaded to Supabase Storage (real objects, large files supported)
 * and stored permanently; metadata lives in the Supabase JSON store via
 * videosApi. If Storage is not configured, it gracefully falls back to a
 * base64 data URL. Admins and teachers can upload and delete; students watch.
 * Videos can optionally be linked to a course or lesson.
 */
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { courseApi, videosApi } from '../../services/api';
import {
  deleteFromStorage, uploadToStorage, storageObjectUrl,
} from '../../services/supabase';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea,
} from '../../components/ui';
import type { Video } from '../../types';

/** Soft cap for base64 fallback (Storage supports far larger files). */
const MAX_MB_FALLBACK = 8;

/** Read a File into a base64 data URL (fallback when Storage is unavailable). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Human-readable file size. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload a video file to Supabase Storage. Returns the stored Video metadata.
 * Falls back to base64 if the bucket is not configured / upload fails.
 */
export async function saveVideoFromFile(
  file: File,
  meta: { title: string; description?: string; category?: string; courseId?: string; lessonId?: string; actorId: string },
  onProgress?: (stage: string) => void,
): Promise<Video> {
  // Attempt Storage first (supports large files).
  try {
    onProgress?.('Uploading to cloud storage…');
    const path = `videos/${Date.now().toString(36)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { path: storedPath, url } = await uploadToStorage(path, file, file.type || 'video/mp4');
    return videosApi.save({
      title: meta.title,
      description: meta.description,
      category: meta.category,
      courseId: meta.courseId,
      lessonId: meta.lessonId,
      storagePath: storedPath,
      storageUrl: url,
      storageProvider: 'storage',
      sizeBytes: file.size,
      mimeType: file.type || 'video/mp4',
    }, meta.actorId);
  } catch {
    // Fallback: base64 (only for smaller files).
    if (file.size > MAX_MB_FALLBACK * 1024 * 1024) {
      throw new Error(
        `File is ${formatSize(file.size)} — too large for the fallback store. ` +
        `Create the "videos" bucket in Supabase Storage to store large files.`,
      );
    }
    onProgress?.('Storing as compressed data…');
    const dataUrl = await readAsDataUrl(file);
    return videosApi.save({
      title: meta.title,
      description: meta.description,
      category: meta.category,
      courseId: meta.courseId,
      lessonId: meta.lessonId,
      dataUrl,
      storageProvider: 'base64',
      sizeBytes: file.size,
      mimeType: file.type || 'video/mp4',
    }, meta.actorId);
  }
}

export function VideoLibrary({ teacher }: { teacher?: boolean }) {
  const { user, toast } = useApp();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';
  const [videos, setVideos] = useState<Video[]>(() => videosApi.list());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playing, setPlaying] = useState<Video | null>(null);

  const refresh = () => setVideos(videosApi.list());

  const remove = async (v: Video) => {
    if (!confirm(`Delete video "${v.title}"?`)) return;
    videosApi.remove(v.id, user?.id ?? 'u-admin');
    toast('Video deleted', 'success');
    refresh();
  };

  return (
    <Card
      title="Video Library"
      subtitle={`${videos.length} videos — uploaded and stored permanently`}
      action={canManage ? (
        <Button className="h-9 px-3 text-xs" onClick={() => setUploadOpen(true)}>+ Upload video</Button>
      ) : undefined}>
      {videos.length === 0 ? (
        <EmptyState>{canManage ? 'No videos yet — upload one to get started.' : 'No videos available yet.'}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <video
                src={videosApi.playableUrl(v)} controls preload="metadata"
                className="aspect-video w-full bg-slate-900"
              />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{v.title}</p>
                  <Badge tone="blue">{v.category}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{formatSize(v.sizeBytes)}</span>
                  {v.storageProvider === 'storage' ? (
                    <Badge tone="green">cloud</Badge>
                  ) : (
                    <Badge tone="amber">inline</Badge>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 p-2">
                  <Button className="h-8 px-2 text-xs" onClick={() => setPlaying(v)}>Watch</Button>
                  <Button className="h-8 px-2 text-xs" variant="danger" onClick={() => remove(v)}>Delete</Button>
                </div>
              )}
              {!canManage && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                  <Button className="h-8 w-full text-xs" onClick={() => setPlaying(v)}>▶ Play</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {uploadOpen && (
        <UploadForm
          courses={courseApi.list()}
          onClose={() => { setUploadOpen(false); refresh(); }}
          onUploaded={refresh}
        />
      )}
      {playing && (
        <Modal open onClose={() => setPlaying(null)} title={playing.title} wide>
          <video
            src={videosApi.playableUrl(playing)}
            controls autoPlay className="w-full rounded-lg bg-slate-900"
          />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{playing.description}</p>
        </Modal>
      )}
    </Card>
  );
}

/** Reusable upload form (used by VideoLibrary and AdminDashboard). */
export function UploadForm({
  courses, onClose, onUploaded, actorId,
}: {
  courses: Array<{ id: string; title: string }>;
  onClose: () => void;
  onUploaded: () => void;
  actorId?: string;
}) {
  const { user, toast } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [courseId, setCourseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!file) { setError('Please choose a video file.'); return; }
    if (!title.trim()) { setError('Please enter a title.'); return; }
    setBusy(true);
    try {
      await saveVideoFromFile(file, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'General',
        courseId: courseId || undefined,
        actorId: actorId ?? user?.id ?? 'u-admin',
      }, setStage);
      toast('Video uploaded and stored', 'success');
      onUploaded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Upload video" wide>
      <div className="grid gap-3">
        <Field label="File">
          <input
            type="file" accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-600 hover:file:bg-indigo-100"
          />
          {file && <p className="mt-1 text-xs text-slate-500">{file.name} ({formatSize(file.size)})</p>}
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acid-base titration demo" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="General" />
          </Field>
          <Field label="Course (optional)">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— none —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        {stage && <p className="text-xs text-indigo-600 dark:text-indigo-300">{stage}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Button>
        </div>
      </div>
    </Modal>
  );
}
