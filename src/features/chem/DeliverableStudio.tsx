/**
 * Deliverable Studio — "file extraction" / deliverable generation.
 *
 * The teacher stores the master prompt once (the fixed prompt that drives all
 * deliverable generation), uploads base/template files and a lesson file,
 * picks a deliverable type, and presses "Generate". A job record is created
 * (persisted in Supabase) and the generation then runs interactively with the
 * agent (via Arena), which follows the master prompt's button wizard and
 * produces the deliverable files.
 *
 * Sections:
 *   1. Master prompt   — paste once, save, reused for every job.
 *   2. Base files      — template / source files (PDFs etc.) — permanent.
 *   3. Lesson file     — the lesson content to generate from — permanent.
 *   4. Generate        — pick a deliverable type, title, notes, press Generate.
 *   5. Jobs            — history of generation jobs with status.
 */
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { deliverableApi } from '../../services/api';
import {
  Badge, Button, Card, EmptyState, Field, Input, Textarea, SectionTitle,
} from '../../components/ui';
import type { DeliverableType, DeliverableJob } from '../../types';

/** Deliverable options mapped to the master prompt wizard's deliverable codes. */
const DELIVERABLES: { code: DeliverableType; label: string; desc: string }[] = [
  { code: 'summary', label: 'Summary', desc: '[A] Comprehensive Summary' },
  { code: 'worksheet', label: 'Worksheet', desc: '[B] Lesson Worksheet' },
  { code: 'quiz', label: 'Quiz (20 Marks)', desc: '[C] Lesson Quiz' },
  { code: 'exam', label: 'Exam (40 Marks)', desc: '[D] Unit Exam' },
  { code: 'lesson-plan', label: 'Lesson Plan', desc: '[E] Professional Lesson Plan' },
  { code: 'full-package', label: 'Full Package', desc: '[F] Full Lesson Package' },
  { code: 'booklet', label: 'Revision Booklet', desc: '[H] Final Revision Booklet' },
  { code: 'night-revision', label: 'Night Revision', desc: '[I] Exam-Night Revision' },
];

/** Human-readable file size. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DeliverableStudio() {
  const { user, toast } = useApp();
  const actorId = user?.id ?? 'u-admin';

  const [prompt, setPrompt] = useState(() => deliverableApi.getMasterPrompt()?.prompt ?? '');
  const [promptSaved, setPromptSaved] = useState(() => deliverableApi.getMasterPrompt()?.prompt.length ?? 0);
  const [baseFiles, setBaseFiles] = useState(() => deliverableApi.files('base'));
  const [lessonFiles, setLessonFiles] = useState(() => deliverableApi.files('lesson'));
  const [jobs, setJobs] = useState(() => deliverableApi.listJobs());

  const [type, setType] = useState<DeliverableType>('quiz');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [handoff, setHandoff] = useState<string | null>(null);

  const refresh = () => {
    setBaseFiles(deliverableApi.files('base'));
    setLessonFiles(deliverableApi.files('lesson'));
    setJobs(deliverableApi.listJobs());
  };

  const savePrompt = () => {
    if (!prompt.trim()) { toast('Master prompt is empty', 'error'); return; }
    deliverableApi.saveMasterPrompt(prompt.trim(), actorId);
    setPromptSaved(prompt.trim().length);
    toast('Master prompt saved', 'success');
  };

  /** Upload one or more files into the given folder. */
  const upload = async (folder: 'base' | 'lesson', files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        await deliverableApi.uploadFile(folder, file, actorId);
      } catch {
        toast(`Failed to upload ${file.name}`, 'error');
      }
    }
    toast(`Uploaded ${files.length} file(s)`, 'success');
    refresh();
  };

  const removeFile = (id: string, name: string) => {
    if (!confirm(`Delete file "${name}"?`)) return;
    deliverableApi.removeFile(id, actorId);
    toast('File deleted', 'success');
    refresh();
  };

  const generate = () => {
    if (promptSaved === 0) { toast('Save the master prompt first', 'error'); return; }
    if (lessonFiles.length === 0) { toast('Upload a lesson file first', 'error'); return; }
    const job = deliverableApi.createJob({
      type, title: title.trim() || `${DELIVERABLES.find((d) => d.code === type)?.label ?? type} deliverable`,
      notes: notes.trim(),
      baseFileIds: baseFiles.map((f) => f.id),
      lessonFileIds: lessonFiles.map((f) => f.id),
      actorId,
    });
    setJobs(deliverableApi.listJobs());
    setHandoff(job.id);
    toast('Generation started — handing off to the agent', 'success');
  };

  return (
    <div className="space-y-4">
      <Card title="Deliverable Studio" subtitle="Store the master prompt, attach base + lesson files, then generate deliverables.">
        <div className="space-y-6">
          {/* 1. Master prompt */}
          <section>
            <SectionTitle action={
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{promptSaved} chars saved</span>
                <Button onClick={savePrompt}>Save prompt</Button>
              </div>
            }>1. Master Prompt</SectionTitle>
            <Field label="The fixed prompt that drives all deliverable generation (paste once, saved permanently)" hint="This is reused for every job — edit and re-save anytime.">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder="Paste the master prompt here…"
              />
            </Field>
          </section>

          {/* 2 & 3. Files */}
          <div className="grid gap-6 lg:grid-cols-2">
            <FileSection
              title="2. Base / Template Files"
              hint="Templates, format references, revision booklets (PDF/DOCX)."
              files={baseFiles}
              onUpload={(f) => upload('base', f)}
              onRemove={removeFile}
            />
            <FileSection
              title="3. Lesson File"
              hint="The lesson content to generate the deliverable from."
              files={lessonFiles}
              onUpload={(f) => upload('lesson', f)}
              onRemove={removeFile}
            />
          </div>

          {/* 4. Generate */}
          <section>
            <SectionTitle>4. Generate</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label="Deliverable type">
                  <div className="grid grid-cols-2 gap-2">
                    {DELIVERABLES.map((d) => (
                      <button key={d.code} type="button" onClick={() => setType(d.code)}
                        className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                          type === d.code
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'}`}>
                        <span className="block font-semibold text-slate-800 dark:text-slate-100">{d.label}</span>
                        <span className="block text-slate-500">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Title (optional)">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chemical Reactions — Quiz 1" />
                </Field>
                <Field label="Notes / wizard answers (optional)">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder="Grade, subject, semester, quarter, source alignment, etc. — these guide the wizard." />
                </Field>
                <Button onClick={generate} className="w-full">⚡ Generate deliverable</Button>
              </div>

              {/* Handoff + jobs */}
              <div className="space-y-3">
                {handoff && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/30">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">Generation handed off</p>
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      Job created. The agent now runs the master prompt's interactive wizard — reply in
                      the chat to answer the wizard questions and the deliverable will be produced.
                    </p>
                    <Button variant="ghost" className="mt-2 h-7 text-xs" onClick={() => setHandoff(null)}>Dismiss</Button>
                  </div>
                )}
                <SectionTitle action={<Badge tone="slate">{jobs.length} job(s)</Badge>}>Job history</SectionTitle>
                {jobs.length === 0 ? (
                  <EmptyState>No jobs yet — press Generate to start one.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((j) => <JobRow key={j.id} job={j} />)}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
}

/** A file-upload section (base or lesson). */
function FileSection({
  title, hint, files, onUpload, onRemove,
}: {
  title: string; hint: string; files: { id: string; name: string; sizeBytes: number; storageProvider: string }[];
  onUpload: (f: FileList | null) => void; onRemove: (id: string, name: string) => void;
}) {
  return (
    <Card>
      <SectionTitle action={<Badge tone="slate">{files.length} file(s)</Badge>}>{title}</SectionTitle>
      <p className="mb-3 text-xs text-slate-500">{hint}</p>
      <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-4 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600">
        ⬆ Upload file
        <input type="file" multiple
          className="hidden"
          onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
      </label>
      {files.length === 0 ? (
        <EmptyState>No files attached.</EmptyState>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700 dark:text-slate-200">{f.name}</p>
                <p className="text-xs text-slate-500">{formatSize(f.sizeBytes)} · {f.storageProvider}</p>
              </div>
              <Button variant="ghost" className="h-7 text-xs text-rose-600" onClick={() => onRemove(f.id, f.name)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** A job row in the history list. */
function JobRow({ job }: { job: DeliverableJob }) {
  const label = DELIVERABLES.find((d) => d.code === job.type)?.label ?? job.type;
  const tone = job.status === 'delivered' ? 'green'
    : job.status === 'running' ? 'amber'
    : 'slate';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{job.title}</p>
        <p className="text-xs text-slate-500">{label} · {new Date(job.at).toLocaleString()}</p>
      </div>
      <Badge tone={tone as 'slate' | 'green' | 'amber'}>{job.status}</Badge>
    </div>
  );
}
