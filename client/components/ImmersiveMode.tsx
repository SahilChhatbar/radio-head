import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Dialog, Flex, Text } from '@radix-ui/themes';
import { Maximize2, X } from 'lucide-react';

// Global audio context and analyser - persists across all renders
let globalAudioContext = null;
let globalAnalyser = null;
let connectedSource = null;

// Visualizer Canvas Component
const VisualizerCanvas = ({ isActive, currentStation }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const [audioStatus, setAudioStatus] = useState('Initializing...');
    const [streamType, setStreamType] = useState('unknown');

    // Initialize global audio context once
    const initAudioContext = useCallback(() => {
        if (!globalAudioContext) {
            try {
                globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                globalAnalyser = globalAudioContext.createAnalyser();
                globalAnalyser.fftSize = 1024;
                globalAnalyser.smoothingTimeConstant = 0.85;
                globalAnalyser.minDecibels = -90;
                globalAnalyser.maxDecibels = -10;
                console.log('🎵 Global audio context initialized');
            } catch (error) {
                console.error('❌ Failed to create audio context:', error);
                setAudioStatus('Audio context error');
            }
        }
        return globalAudioContext && globalAnalyser;
    }, []);

    // Connect to the active audio source
    const connectAudioSource = useCallback(() => {
        if (!globalAudioContext) {
            console.warn('⚠️ Audio context not initialized');
            setAudioStatus('⚠️ Audio context missing');
            return false;
        }

        try {
            // --- HOWLER (preferred) ---
            if (window.Howler && window.Howler.ctx) {
                console.log('🔍 Trying Howler tap...');
                const howlerCtx = window.Howler.ctx;
                // ensure analyser is in same context
                if (howlerCtx !== globalAudioContext) {
                    globalAudioContext = howlerCtx;
                    globalAnalyser = globalAudioContext.createAnalyser();
                    globalAnalyser.fftSize = 1024;
                    globalAnalyser.smoothingTimeConstant = 0.85;
                    globalAnalyser.minDecibels = -90;
                    globalAnalyser.maxDecibels = -10;
                }

                // Try to find a master gain node exposed by Howler
                const masterGain = window.Howler.masterGain || window.Howler._masterGain || null;
                if (masterGain && typeof masterGain.connect === 'function') {
                    // Do NOT call masterGain.disconnect() — that sometimes mutes Howler output.
                    // Instead add an additional connection from masterGain -> tapGain -> analyser.
                    try {
                        // Disconnect previous connectedSource if any
                        if (connectedSource) {
                            try { connectedSource.disconnect(); } catch (e) { /* ignore */ }
                        }

                        const tapGain = globalAudioContext.createGain();
                        tapGain.gain.value = 1.0;

                        // Connect masterGain -> tapGain -> analyser
                        // Keep existing masterGain connections intact by not calling disconnect()
                        masterGain.connect(tapGain);
                        tapGain.connect(globalAnalyser);

                        connectedSource = tapGain;
                        setStreamType('Howler.js');
                        setAudioStatus('✅ Connected (Howler)');
                        console.log('✅ Connected analyser to Howler (tapGain).');
                        return true;
                    } catch (err) {
                        console.warn('⚠️ Howler tap failed:', err);
                    }
                }

                // fallback: try to tap first active sound node
                if (window.Howler._howls && window.Howler._howls.length) {
                    const first = window.Howler._howls[0];
                    try {
                        // try private nodes which may exist depending on Howler version
                        const gainNode = first._sounds?.[0]?._node?.gain || first._sounds?.[0]?._panner || null;
                        if (gainNode && typeof gainNode.connect === 'function') {
                            if (connectedSource) try { connectedSource.disconnect(); } catch (e) { }
                            const tap = globalAudioContext.createGain();
                            gainNode.connect(tap);
                            tap.connect(globalAnalyser);
                            connectedSource = tap;
                            setStreamType('Howler (sound node)');
                            setAudioStatus('✅ Connected (Howler sound)');
                            console.log('✅ Connected to Howler sound node.');
                            return true;
                        }
                    } catch (err) {
                        // ignore, best-effort
                    }
                }
            }

            // --- TONE.JS ---
            if (window.Tone && window.Tone.context) {
                console.log('🔍 Trying Tone.js tap...');
                const toneCtx = window.Tone.context;
                if (toneCtx !== globalAudioContext) {
                    globalAudioContext = toneCtx;
                    globalAnalyser = globalAudioContext.createAnalyser();
                    globalAnalyser.fftSize = 1024;
                    globalAnalyser.smoothingTimeConstant = 0.85;
                }

                try {
                    const dest = window.Tone.getDestination && window.Tone.getDestination();
                    // Tone's destination often has an "input" or is connectable
                    if (dest && dest.input && typeof dest.input.connect === 'function') {
                        if (connectedSource) try { connectedSource.disconnect(); } catch (e) { }
                        const splitter = globalAudioContext.createGain();
                        dest.input.connect(splitter);
                        splitter.connect(globalAnalyser);
                        connectedSource = splitter;
                        setStreamType('Tone.js');
                        setAudioStatus('✅ Connected (Tone.js)');
                        console.log('✅ Connected analyser to Tone.js destination.');
                        return true;
                    }
                } catch (err) {
                    console.warn('⚠️ Tone tap failed:', err);
                }
            }

            // --- HTML5 <audio> element ---
            const audioElement = document.querySelector('audio');
            if (audioElement && audioElement.src) {
                console.log('🔍 Trying HTML5 audio element tap...');
                // If already tapped to same element, keep status
                if (connectedSource && connectedSource._element === audioElement) {
                    setAudioStatus('✅ Connected (HTML5)');
                    setStreamType('HLS/HTML5');
                    return true;
                }

                try {
                    if (connectedSource) try { connectedSource.disconnect(); } catch (e) { }
                    const source = globalAudioContext.createMediaElementSource(audioElement);
                    source._element = audioElement;
                    source.connect(globalAnalyser);
                    // do NOT rewire the destination if it was already playing elsewhere
                    // ensure we don't break playback graph
                    connectedSource = source;
                    setStreamType('HLS/HTML5');
                    setAudioStatus('✅ Connected (HLS)');
                    console.log('✅ Connected analyser to HTML audio element.');
                    return true;
                } catch (err) {
                    console.warn('⚠️ createMediaElementSource failed (maybe already connected):', err);
                    setAudioStatus('⚠️ Shared audio (limited viz)');
                }
            }

            // nothing found
            console.warn('⚠️ No active audio source detected (tap failed)');
            setAudioStatus('⚠️ No audio detected');
            setStreamType('unknown');
            return false;
        } catch (error) {
            console.error('❌ Connection error:', error);
            setAudioStatus('❌ Connection failed');
            setStreamType('unknown');
            return false;
        }
    }, []);
    // Setup audio pipeline
    useEffect(() => {
        if (!isActive) return;

        const setupAudio = async () => {
            const contextReady = initAudioContext();
            if (!contextReady) return;

            // Resume audio context if suspended
            if (globalAudioContext.state === 'suspended') {
                try {
                    await globalAudioContext.resume();
                    console.log('▶️ Audio context resumed');
                } catch (error) {
                    console.error('❌ Failed to resume audio context:', error);
                }
            }

            // Try to connect
            let connected = connectAudioSource();

            // Retry connection periodically if failed
            if (!connected) {
                const retryInterval = setInterval(() => {
                    const success = connectAudioSource();
                    if (success) {
                        clearInterval(retryInterval);
                    }
                }, 1000);

                return () => clearInterval(retryInterval);
            }
        };

        setupAudio();
    }, [isActive, initAudioContext, connectAudioSource]);

    // Re-connect when station changes
    useEffect(() => {
        if (!isActive || !currentStation) return;

        console.log('🔄 Station changed, reconnecting...', currentStation);

        // Delay to allow audio to initialize
        const timer = setTimeout(() => {
            connectAudioSource();
        }, 800);

        return () => clearTimeout(timer);
    }, [currentStation?.stationuuid, isActive, connectAudioSource]);

    // Canvas drawing loop
    useEffect(() => {
        if (!isActive || !globalAnalyser) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        const bufferLength = globalAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Set canvas size with device pixel ratio
        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
            ctx.scale(dpr, dpr);
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Enhanced drawing function
        const draw = () => {
            if (!isActive) return;

            const WIDTH = window.innerWidth;
            const HEIGHT = window.innerHeight;
            const centerX = WIDTH / 2;
            const centerY = HEIGHT / 2;

            globalAnalyser.getByteFrequencyData(dataArray);

            // Clear with gradient background
            const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, Math.max(WIDTH, HEIGHT) / 2
            );
            gradient.addColorStop(0, '#16283a');
            gradient.addColorStop(1, '#0c1521');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            // Calculate responsive radius
            const RADIUS = Math.min(WIDTH, HEIGHT) * 0.28;
            const LINES_AMOUNT = 180;

            ctx.save();
            ctx.translate(centerX, centerY);

            // Calculate average amplitude for pulsing
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const pulse = 1 + (average / 255) * 0.15;

            // Draw outer glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'rgba(255, 145, 77, 0.3)';

            // Draw base circle with gradient
            ctx.beginPath();
            ctx.arc(0, 0, RADIUS * pulse, 0, Math.PI * 2);
            const circleGradient = ctx.createRadialGradient(
                0, 0, RADIUS * pulse - 20,
                0, 0, RADIUS * pulse
            );
            circleGradient.addColorStop(0, 'rgba(250, 249, 246, 0.1)');
            circleGradient.addColorStop(1, 'rgba(250, 249, 246, 0.4)');
            ctx.strokeStyle = circleGradient;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Draw frequency bars
            for (let i = 0; i < 360; i++) {
                if (i % (360 / LINES_AMOUNT) === 0) {
                    const index = Math.floor((i / 360) * bufferLength);
                    const value = dataArray[index] || 0;

                    // Enhanced bar height calculation
                    const normalizedValue = value / 255;
                    const barHeight = normalizedValue * (RADIUS * 1.2) * pulse;
                    const bigRadius = RADIUS * pulse + barHeight;

                    const angle = (i * Math.PI) / 180;
                    const x = (RADIUS * pulse) * Math.cos(angle);
                    const y = (RADIUS * pulse) * Math.sin(angle);
                    const big_x = bigRadius * Math.cos(angle);
                    const big_y = bigRadius * Math.sin(angle);

                    // Dynamic color and width based on frequency
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(big_x, big_y);

                    if (value > 220) {
                        ctx.strokeStyle = '#ff914d';
                        ctx.lineWidth = 4;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = '#ff914d';
                    } else if (value > 180) {
                        ctx.strokeStyle = '#ff9d5c';
                        ctx.lineWidth = 3;
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = '#ff914d';
                    } else if (value > 140) {
                        ctx.strokeStyle = '#ffaa70';
                        ctx.lineWidth = 2.5;
                        ctx.shadowBlur = 3;
                        ctx.shadowColor = '#ff914d';
                    } else {
                        ctx.strokeStyle = `rgba(255, 145, 77, ${0.3 + normalizedValue * 0.7})`;
                        ctx.lineWidth = 2;
                        ctx.shadowBlur = 0;
                    }

                    ctx.stroke();
                }
            }

            ctx.shadowBlur = 0;
            ctx.restore();

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive]);

    return (
        <>
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: '#16283a',
                }}
            />
            {/* Debug status indicator */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                color: '#ff914d',
                fontSize: '12px',
                fontFamily: 'monospace',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '10px 15px',
                borderRadius: '6px',
                zIndex: 998,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 145, 77, 0.3)',
            }}>
                <div style={{ marginBottom: '4px' }}>
                    <strong>Status:</strong> {audioStatus}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                    <strong>Type:</strong> {streamType}
                </div>
            </div>
        </>
    );
};

// Main Component with Dialog
const ImmersiveVisualizer = ({ currentStation }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Trigger Button */}
            <Button
                variant="ghost"
                size="2"
                onClick={() => setIsOpen(true)}
                className="hover:bg-[#FF914D]/10"
                title="Immersive Mode"
            >
                <Maximize2 size={20} color="#FF914D" />
            </Button>

            {/* Fullscreen Dialog */}
            <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
                <Dialog.Content
                    style={{
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                        width: '100vw',
                        height: '100vh',
                        padding: 0,
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        background: '#16283a',
                        border: 'none',
                        overflow: 'hidden',
                    }}
                >
                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            zIndex: 1000,
                            background: 'rgba(255, 145, 77, 0.2)',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        <X size={24} color="#FF914D" />
                    </Button>

                    {/* Visualizer Canvas */}
                    <VisualizerCanvas isActive={isOpen} currentStation={currentStation} />

                    {/* Station Info Overlay */}
                    {currentStation && (
                        <Flex
                            direction="column"
                            align="center"
                            justify="center"
                            style={{
                                position: 'absolute',
                                bottom: '40px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 999,
                                background: 'rgba(12, 21, 33, 0.8)',
                                backdropFilter: 'blur(10px)',
                                padding: '20px 40px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 145, 77, 0.3)',
                                minWidth: '300px',
                                maxWidth: '600px',
                            }}
                            gap="2"
                        >
                            <Text size="5" weight="bold" style={{ color: '#FAF9F6', textAlign: 'center' }}>
                                {currentStation.name || 'Unknown Station'}
                            </Text>
                            {currentStation.country && (
                                <Text size="3" style={{ color: '#ff914d', opacity: 0.9 }}>
                                    {currentStation.country}
                                </Text>
                            )}
                            <Text size="2" style={{ color: '#ff914d', opacity: 0.7, marginTop: '8px' }}>
                                Press ESC or click X to exit
                            </Text>
                        </Flex>
                    )}
                </Dialog.Content>
            </Dialog.Root>
        </>
    );
};
export default ImmersiveVisualizer;
