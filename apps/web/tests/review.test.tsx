import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { NotebookProvider } from '@/components/notebook-provider';
import { Picture } from '@/components/picture';
import { MomentPlayer } from '@/components/moment-player';
import { PostForm } from '@/components/record-actions';
import { cleanCaptions, cleanVideoText } from '@/lib/media/captions';
import { safeReturnTo } from '@/lib/navigation';
import { factorPatterns, insights, type ComparisonSet } from '@/lib/analysis';
import type { Clip, Picture as Pic } from '@/lib/types';
const { push, refresh, postJson, viewer } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), postJson: vi.fn(), viewer: { current: null as null | { id: string } } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }), usePathname: () => '/' }));
vi.mock('@/components/use-account', () => ({ useAccount: () => ({ viewer: viewer.current }), postJson }));
beforeEach(() => { push.mockReset(); refresh.mockReset(); postJson.mockReset(); viewer.current = null; });
const vtt = 'WEBVTT\n\n00:00.000 --> 00:02.000\nThe pot is lowered into the sand.\n';
const photo: Pic = { src: '/photo.jpg', small: '/small.jpg', alt: 'Two clay pots with damp sand between them.', width: 1200, height: 800, credit: { author: 'Ama', license: 'CC BY 4.0', source: '' } };
const clip: Clip = { src: '/recording.mp4', type: 'video/mp4', bytes: 12000, title: 'Preparing the cooler', duration: 20, moments: [], transcript: 'Two clay pots are separated by damp sand. The smaller pot holds tomatoes.', captions: vtt, captionLanguage: 'en', poster: photo };

describe('media on the publishing path', () => {
  it('omits all photo and video requests on the server in light reading', () => {
    const html = renderToString(<NotebookProvider initialLite initialMode="lite"><Picture picture={photo} /><MomentPlayer clip={clip} /></NotebookProvider>);
    expect(html).not.toMatch(/<(img|video|source|track)\b/);
    expect(html).not.toContain('poster=');
    expect(html).not.toContain('/recording.mp4');
    expect(html).toContain(clip.transcript!);
    expect(html).toContain(photo.alt);
  });
  it('loads a photo on request and keeps its description on failure', async () => {
    const user = userEvent.setup();
    const { container } = render(<NotebookProvider initialLite initialMode="lite"><Picture picture={photo} /></NotebookProvider>);
    expect(container.querySelector('img')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Load photo' }));
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText(photo.alt)).toBeVisible();
    expect(screen.getByText('The image couldn’t load. Its description is still available.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try loading again' }));
    expect(screen.getByRole('img')).toHaveAttribute('decoding', 'async');
  });
  it('uses native video controls and caption language while retaining text after failure', () => {
    const { container } = render(<NotebookProvider><MomentPlayer clip={clip} /></NotebookProvider>);
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video.querySelector('track')).toHaveAttribute('srclang', 'en');
    fireEvent.error(video);
    expect(screen.getByText(clip.transcript!)).toBeInTheDocument();
    expect(screen.getByText(/The video couldn’t load/)).toBeVisible();
  });
  it('requires accessible text and validates timed, plain-text captions', () => {
    expect(cleanCaptions(vtt)).toBe(vtt);
    expect(cleanVideoText({ transcript: clip.transcript, captions: vtt }).silent).toBe(false);
    expect(cleanVideoText({ transcript: clip.transcript, silent: true }).captions).toBeUndefined();
    expect(() => cleanVideoText({ transcript: clip.transcript })).toThrow(/caption/);
    expect(() => cleanVideoText({ silent: true })).toThrow(/transcript/);
    for (const bad of [vtt.replace('00:02.000', '00:00.000'), vtt.replace('pot', '<b>pot</b>'), 'WEBVTT\n\nSTYLE\n::cue { background: url(https://example.com) }', 'x'.repeat(64001)]) expect(() => cleanCaptions(bad)).toThrow();
  });
});

describe('sign-in without losing the task', () => {
  const form = () => <NotebookProvider><PostForm endpoint="/api/proposals" submit="Share proposal"><label>Proposal<textarea name="change" /></label><label><input type="checkbox" name="notify" value="yes" defaultChecked />Notify me</label><input type="password" name="secret" aria-label="Secret" /></PostForm></NotebookProvider>;
  it('restores text and an unchecked option after returning, excluding sensitive values', async () => {
    const user = userEvent.setup();
    const first = render(form());
    await user.type(screen.getByRole('textbox', { name: 'Proposal' }), 'Keep this proposed change while I sign in.');
    await user.click(screen.getByRole('checkbox'));
    await user.type(screen.getByLabelText('Secret'), 'do-not-store');
    await user.click(screen.getByRole('button', { name: 'Share proposal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a name');
    expect(JSON.stringify(sessionStorage)).not.toContain('do-not-store');
    await user.click(screen.getByRole('link', { name: 'Choose a name' }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/account\?next=/));
    first.unmount();
    viewer.current = { id: 'signed-in' };
    render(form());
    expect(screen.getByRole('textbox')).toHaveValue('Keep this proposed change while I sign in.');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByLabelText('Secret')).toHaveValue('');
    postJson.mockResolvedValueOnce({ id: 'new' });
    await user.click(screen.getByRole('button', { name: 'Share proposal' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(sessionStorage.length).toBe(0);
    expect(postJson).toHaveBeenCalledWith('/api/proposals', expect.objectContaining({ change: 'Keep this proposed change while I sign in.' }));
  });
  it('keeps valid return context and rejects external or disguised redirects', () => {
    expect(safeReturnTo('/problems/example?tab=discussion#reply')).toBe('/problems/example?tab=discussion#reply');
    for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2fevil.example', '/%5cevil.example', '/\n/evil.example']) expect(safeReturnTo(path)).toBeUndefined();
  });
});

describe('honest comparisons', () => {
  const set: ComparisonSet = { slug: 'conditions', title: 'Test', question: 'What differed?', measureLabel: 'Yield', measureUnit: ' kg', factors: ['Water'], attempts: [
    { id: 'A', label: 'A', title: 'Dry plot', by: 'Ama', values: { Water: 'Low' }, result: 'failed', evidence: 'verified' },
    { id: 'B', label: 'B', title: 'Irrigated plot', by: 'Ama', values: { Water: 'High' }, result: 'succeeded', measure: 12, evidence: 'verified' },
  ] };
  it('never turns source verification or two different results into causal verification', () => {
    const found = insights(set);
    expect(found.some((i) => i.kind === 'verified')).toBe(false);
    expect(found.every((i) => i.confidence === 'low')).toBe(true);
    expect(found[0].text).toContain('not evidence that the factor caused');
    expect(found[0].text).not.toContain('mean');
    expect(found[0].text).not.toContain('%');
  });
  it('excludes missing measurements rather than assigning zero', () => {
    const found = insights({ ...set, attempts: [...set.attempts, { ...set.attempts[0], id: 'C', measure: 4 }] });
    expect(found[0].text).toContain('12 kg (1 recorded) and 4 kg (1 recorded)');
  });
  it('does not treat an ongoing or unrecorded result as success', () => {
    const incomplete = { ...set, attempts: set.attempts.map((a) => ({ ...a, result: 'unknown' as const })) };
    expect(factorPatterns(incomplete)[0].separation).toBe(0);
    expect(insights(incomplete).some((i) => i.kind === 'hypothesis')).toBe(false);
  });
});
