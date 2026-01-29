import { useRef, useEffect, useState } from 'react';
import { logger } from '../utils/logger';

export const useCamera = (externalVideoRef?: React.RefObject<HTMLVideoElement>) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onStreamReady, setOnStreamReady] = useState<(() => void) | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        logger.log('useCamera', 'Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        setIsReady(true);
        setStreamReady(true);
        logger.log('useCamera', 'Camera stream obtained successfully');
        
        // Set callback to be called when stream is ready
        setOnStreamReady(() => () => {
          logger.log('useCamera', 'Stream ready callback triggered');
        });
      } catch (error) {
        setError('Camera access failed: ' + (error instanceof Error ? error.message : String(error)));
        logger.log('useCamera', 'Camera access failed: ' + (error instanceof Error ? error.message : String(error)));
      }
    };

    init();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return {
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    stream: streamRef.current,
    isReady,
    error,
    onStreamReady,
    streamReady,
  }
};