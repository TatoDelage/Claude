import { useCallback, useEffect, useRef, useState } from "react";

export function useTimer() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);
  const durationRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      setTimeout(() => onCompleteRef.current?.(), 0);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [running, remaining]);

  const start = useCallback((seconds: number, onComplete?: () => void) => {
    onCompleteRef.current = onComplete;
    durationRef.current = seconds;
    setRemaining(seconds);
    setRunning(true);
  }, []);

  const stop = useCallback(() => setRunning(false), []);

  /** Resume countdown from current remaining (after stop). */
  const resume = useCallback((onComplete?: () => void) => {
    if (onComplete) onCompleteRef.current = onComplete;
    setRunning(true);
  }, []);

  /** Add seconds to the running (or paused) timer. */
  const addTime = useCallback((seconds: number) => {
    durationRef.current = durationRef.current + seconds;
    setRemaining((r) => r + seconds);
  }, []);

  const duration = durationRef.current;
  const progress = duration > 0 ? remaining / duration : 0;

  return { remaining, running, progress, start, stop, resume, addTime };
}
