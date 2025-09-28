import { describe, it, expect } from 'vitest';
import { POST } from '../../api/get-move/route';

function makeRequest(body: any) {
  return new Request('http://localhost/api/get-move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/get-move', () => {
  it('returns fallback move for empty board safely', async () => {
    const req = makeRequest({ board: [], player: 'black' });
    const res = await POST(req as any);
    expect(res.ok).toBe(true);
    const data = await (res as Response).json();
    expect(Array.isArray(data.move)).toBe(true);
    expect(data.move.length).toBe(2);
  });

  it('returns fallback move for 15x15 board', async () => {
    const B = Array.from({ length: 15 }, () => Array(15).fill(null));
    const req = makeRequest({ board: B, player: 'black' });
    const res = await POST(req as any);
    expect(res.ok).toBe(true);
    const data = await (res as Response).json();
    expect(Array.isArray(data.move)).toBe(true);
  });
});

