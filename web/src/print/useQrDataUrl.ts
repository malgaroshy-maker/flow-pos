import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export function useQrDataUrl(text: string | null | undefined, width: number = 160): string | null {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(text, { margin: 0, width })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text, width]);

  return qrUrl;
}
