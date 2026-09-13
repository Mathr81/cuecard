import { describe, expect, it } from 'vitest';
import { parseSubtitles } from './parse';
import { decodeSubtitleBuffer } from './decode';
import { toWordChips, tokenizeLine } from './tokenize';
import { CueSearchIndex, highlightRanges, normalizeForSearch } from './search';
import { mergeOverlappingCues } from './merge';
import { formatTimestamp } from '../time';

const SRT = `1
00:00:01,000 --> 00:00:03,500
<i>Hello</i> there.

2
00:00:04,000 --> 00:00:06,000
{\\an8}You're gonna love this,
mother-in-law.

3
00:00:06,500 --> 00:00:08,000
&amp; that's &quot;it&quot;.
`;

describe('parseSubtitles', () => {
  it('parses a standard SRT and strips markup', () => {
    const result = parseSubtitles(SRT);
    expect(result.format).toBe('srt');
    expect(result.cues).toHaveLength(3);
    expect(result.cues[0]).toMatchObject({
      index: 0,
      startMs: 1000,
      endMs: 3500,
      text: 'Hello there.',
    });
    expect(result.cues[1].text).toBe("You're gonna love this,\nmother-in-law.");
    expect(result.cues[2].text).toBe('& that\'s "it".');
  });

  it('parses VTT, ignores the header and NOTE blocks, accepts MM:SS timings', () => {
    const vtt = `WEBVTT

NOTE this file was machine generated

00:01.000 --> 00:03.000
<c.yellow>First</c> line

NOTE another note

2
00:04.000 --> 00:05.000
<v Alice>Second line
`;
    const result = parseSubtitles(vtt);
    expect(result.format).toBe('vtt');
    expect(result.cues.map((c) => c.text)).toEqual(['First line', 'Second line']);
    expect(result.cues[0].startMs).toBe(1000);
  });

  it('survives missing indices, blank lines inside a cue and hour overflow', () => {
    const messy = `00:00:01,000 --> 00:00:02,000
Line one

Line two

100:00:00,000 --> 100:00:01,000
Late night
`;
    const result = parseSubtitles(messy);
    expect(result.cues[0].text).toBe('Line one\nLine two');
    expect(result.cues[1].startMs).toBe(100 * 3600_000);
  });

  it('drops cues that are empty once cleaned', () => {
    const result = parseSubtitles(`1
00:00:01,000 --> 00:00:02,000
{\\pos(192,220)}

2
00:00:03,000 --> 00:00:04,000
Real text
`);
    expect(result.cues).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it('repairs a cue whose end precedes its start', () => {
    const result = parseSubtitles(`1
00:00:10,000 --> 00:00:05,000
Broken timing
`);
    expect(result.cues[0].endMs).toBe(11_000);
  });
});

describe('mergeOverlappingCues', () => {
  it('merges simultaneous cues and reindexes', () => {
    const merged = mergeOverlappingCues([
      { index: 0, startMs: 1000, endMs: 4000, text: 'Speaker one' },
      { index: 1, startMs: 2000, endMs: 5000, text: 'Speaker two' },
      { index: 2, startMs: 6000, endMs: 7000, text: 'Later' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      index: 0,
      startMs: 1000,
      endMs: 5000,
      text: 'Speaker one\nSpeaker two',
    });
    expect(merged[1].index).toBe(1);
  });

  it('deduplicates a line repeated back to back', () => {
    const merged = mergeOverlappingCues([
      { index: 0, startMs: 1000, endMs: 2000, text: 'Yeah.' },
      { index: 1, startMs: 2200, endMs: 3000, text: 'Yeah.' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].endMs).toBe(3000);
  });

  it('keeps two identical lines that are far apart', () => {
    const merged = mergeOverlappingCues([
      { index: 0, startMs: 1000, endMs: 2000, text: 'Yeah.' },
      { index: 1, startMs: 30_000, endMs: 31_000, text: 'Yeah.' },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('decodeSubtitleBuffer', () => {
  it('detects UTF-8', () => {
    const bytes = new TextEncoder().encode('Où est passé le café ?');
    expect(decodeSubtitleBuffer(bytes.buffer as ArrayBuffer)).toEqual({
      text: 'Où est passé le café ?',
      encoding: 'utf-8',
    });
  });

  it('falls back to windows-1252 instead of mangling accents', () => {
    // "Où est passé" en latin-1 : 0xF9 et 0xE9 sont invalides en UTF-8.
    const latin1 = Uint8Array.from([0x4f, 0xf9, 0x20, 0x70, 0x61, 0x73, 0x73, 0xe9]);
    const decoded = decodeSubtitleBuffer(latin1.buffer as ArrayBuffer);
    expect(decoded).toEqual({ text: 'Où passé', encoding: 'windows-1252' });
  });

  it('strips the UTF-8 BOM', () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, 0x68, 0x69]);
    expect(decodeSubtitleBuffer(bytes.buffer as ArrayBuffer).text).toBe('hi');
  });
});

describe('tokenize', () => {
  it('keeps contractions, hyphens and trailing apostrophes as one word', () => {
    const words = tokenizeLine("Don't you go y'all-ing me, I'm goin' home.")
      .filter((t) => t.kind === 'word')
      .map((t) => t.text);
    expect(words).toEqual(["Don't", 'you', 'go', "y'all-ing", 'me', "I'm", "goin'", 'home']);
  });

  it('attaches punctuation to the chip but not to the lookup key', () => {
    const chips = toWordChips('- "Wait," he said.');
    expect(chips.map((c) => c.display)).toEqual(['"Wait,"', 'he', 'said.']);
    expect(chips.map((c) => c.word)).toEqual(['Wait', 'he', 'said']);
    expect(chips[0].before).toBe('- ');
  });
});

describe('CueSearchIndex', () => {
  const cues = parseSubtitles(`1
00:00:01,000 --> 00:00:02,000
I'm not gonna let you down.

2
00:01:05,000 --> 00:01:07,000
Let me down easy, would you?

3
00:02:00,000 --> 00:02:02,000
Completely unrelated line.
`).cues;
  const index = new CueSearchIndex(cues);

  it('finds literal matches first', () => {
    const results = index.search('let you down');
    expect(results[0].cue.index).toBe(0);
    expect(results[0].exact).toBe(true);
  });

  it('tolerates typos', () => {
    const results = index.search('gona let');
    expect(results.map((r) => r.cue.index)).toContain(0);
  });

  it('ignores apostrophes and case', () => {
    expect(index.search('IM NOT')[0].cue.index).toBe(0);
  });

  it('returns nothing for a query below two characters', () => {
    expect(index.search('a')).toEqual([]);
  });

  it('lists every match so I can pick the right moment', () => {
    const results = index.search('down');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.cue.startMs)).toEqual([1000, 65_000]);
  });
});

describe('highlightRanges', () => {
  it('locates each query word in the original text', () => {
    expect(highlightRanges('Let me down easy', 'down')).toEqual([[7, 11]]);
  });

  it('matches through accents without shifting indices', () => {
    expect(highlightRanges('Café society', 'cafe')).toEqual([[0, 4]]);
  });
});

describe('normalizeForSearch', () => {
  it('keeps apostrophes and drops the rest', () => {
    expect(normalizeForSearch("  Don't — STOP!  ")).toBe("don't stop");
  });
});

describe('formatTimestamp', () => {
  it('omits the hour below one hour', () => {
    expect(formatTimestamp(65_000)).toBe('1:05');
    expect(formatTimestamp(3_725_000)).toBe('1:02:05');
  });
});
