"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <h1>App Error</h1>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{String(error?.message || error)}</pre>
        {error?.digest && <p>digest: {error.digest}</p>}
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}

