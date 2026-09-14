'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState, type DragEvent } from 'react';
import { decodeSubtitleBuffer } from '@/lib/subtitles/decode';
import { parseSubtitles } from '@/lib/subtitles/parse';
import { useSubtitleStore } from '@/store/subtitles';

const ACCEPTED = /\.(srt|vtt|sbv|txt)$/i;

export function SubtitleDropzone() {
  const t = useTranslations('home');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const loadDocument = useSubtitleStore((state) => state.loadDocument);
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.test(file.name)) {
      setError(tErrors('unsupportedFile'));
      return;
    }
    if (file.size === 0) {
      setError(tErrors('emptyFile'));
      return;
    }

    setBusy(true);
    try {
      const { text, encoding } = decodeSubtitleBuffer(await file.arrayBuffer());
      const { cues, format } = parseSubtitles(text);

      if (cues.length === 0) {
        setError(tErrors('noCues'));
        return;
      }

      // Clé stable : recharger deux fois le même fichier retrouve son décalage.
      const titleKey = `upload:${file.name}:${file.size}:${file.lastModified}`;

      loadDocument({
        id: `${titleKey}#upload`,
        titleKey,
        fileId: 'upload',
        name: file.name.replace(/\.[^.]+$/, ''),
        subtitle: null,
        source: 'upload',
        releaseName: null,
        encoding,
        format,
        cues,
        loadedAt: Date.now(),
        title: null,
      });
      router.push('/reader');
    } catch (cause) {
      setError(
        tErrors('readFailed', { message: cause instanceof Error ? cause.message : String(cause) })
      );
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? 'border-accent bg-surface-high' : 'border-line bg-surface'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.vtt,.sbv,text/plain"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="min-h-14 w-full rounded-xl bg-accent px-5 text-base font-semibold text-accent-ink disabled:opacity-60"
        >
          {busy ? t('parsing') : t('dropzone')}
        </button>
        <p className="mt-3 hidden text-sm text-muted sm:block">{t('dropzoneHint')}</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
