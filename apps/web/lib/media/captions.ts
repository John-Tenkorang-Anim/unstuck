/** A small plain-text WebVTT subset: no styles, external resources or cue markup. */
export function cleanCaptions(input: unknown): string | undefined {
  if (typeof input !== 'string' || !input.trim()) return undefined;
  if (input.length > 64_000) throw new Error('The caption file must be under 64 KB.');
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!/^WEBVTT(?:\n|$)/.test(source) || /[<>\u0000]/.test(source.replace(/-->/g, '')))
    throw new Error('Use a plain-text .vtt caption file without HTML or styles.');
  const blocks = source.split(/\n{2,}/).slice(1);
  if (!blocks.length || blocks.length > 1000) throw new Error('The caption file needs timed captions.');
  const time = (value: string) => {
    const parts = value.split(':').map(Number);
    return parts.reduce((total, part) => total * 60 + part, 0);
  };
  let previous = -1;
  for (const block of blocks) {
    const lines = block.split('\n');
    if (!lines[0].includes('-->')) lines.shift();
    const match = /^(\d{2}:)?[0-5]\d:[0-5]\d\.\d{3} --> (\d{2}:)?[0-5]\d:[0-5]\d\.\d{3}$/.exec(lines[0] ?? '');
    if (!match || lines.length < 2 || lines.slice(1).join('').trim().length === 0)
      throw new Error('Each caption needs a start time, end time and text.');
    const [start, end] = lines[0].split(' --> ').map(time);
    if (start < previous || end <= start || end > 3600) throw new Error('Caption timings are out of order or outside the recording.');
    previous = start;
  }
  return `${source}\n`;
}

export function cleanVideoText(input: Record<string, unknown>) {
  const transcript = typeof input.transcript === 'string' ? input.transcript.trim() : '';
  if (transcript.length < 10 || transcript.length > 12_000)
    throw new Error('Add a transcript describing the video’s speech, sounds and important visual details (10–12,000 characters).');
  const silent = input.silent === true;
  const captions = cleanCaptions(input.captions);
  if (!silent && !captions) throw new Error('Add a .vtt caption file, or confirm the video has no speech or meaningful audio.');
  const captionLanguage = typeof input.captionLanguage === 'string' && /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(input.captionLanguage) ? input.captionLanguage : 'en';
  return { transcript, silent, captions, captionLanguage };
}
