import React, { useState, useEffect, useRef, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Plus, Minus, X } from 'lucide-react';
import './smartTimer.css';

const parseWesternTimeArray = (brewTimeStr) => {
  if (!brewTimeStr) return [120, 180, 240]; // Default 2, 3, 4 min
  const lower = brewTimeStr.toLowerCase();
  
  if (lower.includes('short')) return [30, 60, 90]; 
  
  // check for range "3-5 min" or "3 to 5 min"
  const rangeMatch = lower.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    const isSec = lower.includes('sec');
    const mult = isSec ? 1 : 60;
    
    // mid value rounded
    const mid = Math.round((min + max) / 2);
    return [min * mult, mid * mult, max * mult];
  }
  
  // check for single number
  const match = lower.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    const isSec = lower.includes('sec');
    const mult = isSec ? 1 : 60;
    
    const base = val * mult;
    const offset = isSec ? 15 : 60;
    return [Math.max(15, base - offset), base, base + offset];
  }
  
  return [120, 180, 240];
};

const getGongfuBase = (tea) => {
  if (tea.gongfu?.baseSec) return tea.gongfu.baseSec;
  // Fallback based on category
  const cats = (tea.categories || []).join(' ').toLowerCase();
  if (cats.includes('oolong') || cats.includes('white') || cats.includes('green')) return 15;
  if (cats.includes('black') || cats.includes('puerh')) return 10;
  return 20;
};

const getMaxSteeps = (tea) => {
  if (tea.gongfu?.maxSteeps) return tea.gongfu.maxSteeps;
  // Fallback based on category
  const cats = (tea.categories || []).join(' ').toLowerCase();
  if (cats.includes('puerh')) return 12;
  if (cats.includes('oolong')) return 10;
  if (cats.includes('white')) return 7;
  if (cats.includes('black')) return 6;
  if (cats.includes('green')) return 5;
  return 8;
};

const getGongfuTime = (baseTime, infusion) => {
  if (infusion <= 1) return baseTime;
  if (infusion === 2) return baseTime + 5;
  if (infusion === 3) return baseTime + 10;
  return baseTime + 10 + ((infusion - 3) * 15);
};

const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Zen singing bowl — warm, low, slow fade
    const bowlTone = (freq, delay, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.1);
    };

    // Single warm bowl strike — C5 with gentle fifth harmonic
    bowlTone(523.25, 0, 3.0);
    bowlTone(784.0, 0.05, 2.0);  // faint G5 overtone

    // Close context after tones finish to prevent AudioContext leak
    setTimeout(() => ctx.close().catch(() => {}), 4000);

  } catch (e) {
    console.warn('Audio not supported or blocked', e);
  }
};

export default function SmartTimer({ tea, onClose }) {
  const [mode, setMode] = useState('western'); // 'western' | 'gongfu'
  const [westernIntensity, setWesternIntensity] = useState(1); // 0=Light, 1=Med, 2=Strong
  const [infusion, setInfusion] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const wakeLockRef = useRef(null);

  // Derive duration from mode/settings — pure computation, no side effects
  const duration = useMemo(() => {
    if (mode === 'western') {
      const times = parseWesternTimeArray(tea.brewTime);
      return times[westernIntensity];
    } else {
      const base = getGongfuBase(tea);
      return getGongfuTime(base, infusion);
    }
  }, [mode, infusion, tea, westernIntensity]);

  // Reset timer when duration changes (mode/settings changed)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- legitimate sync-to-derived-value */
    setTimeLeft(duration);
    setIsActive(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [duration]);

  // Handle WakeLock
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isActive && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake Lock error:', err);
        }
      }
    };
    
    if (isActive) {
      requestWakeLock();
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
        wakeLockRef.current = null;
      }
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
        wakeLockRef.current = null;
      }
    };
  }, [isActive]);

  // Completion callback ref — kept in sync via effect to satisfy React Compiler
  const onCompleteRef = useRef(null);
  useEffect(() => {
    onCompleteRef.current = () => {
      setIsActive(false);
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
      playChime();
    };
  });

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          // Fire completion on next microtask to avoid setState-in-setState
          Promise.resolve().then(() => onCompleteRef.current?.());
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(duration);
  };

  const handleInfusionChange = (delta) => {
    setInfusion(prev => Math.max(1, prev + delta));
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // elapsed goes 0→100 as time passes; strokeOffset 100=empty, 0=full
  const elapsed = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;
  const strokeOffset = 100 - elapsed;

  return (
    <div className="smart-timer-widget expanded">
      <div className="smart-timer-container">
        <button onClick={onClose} className="timer-close-btn" title="Close Timer" aria-label="Close">
          <X size={14} strokeWidth={2.5} />
        </button>

        <div className="timer-clock-section" onClick={toggleTimer} role="button" aria-label={isActive ? "Pause Timer" : "Start Timer"}>
          <svg className="timer-squircle-svg" viewBox="0 0 100 100">
            <path 
              className="timer-squircle-track" 
              d="M 50 4 H 70 A 26 26 0 0 1 96 30 V 70 A 26 26 0 0 1 70 96 H 30 A 26 26 0 0 1 4 70 V 30 A 26 26 0 0 1 30 4 Z"
            />
            {elapsed > 0 && (
              <motion.path 
                className="timer-squircle-progress"
                d="M 50 4 H 70 A 26 26 0 0 1 96 30 V 70 A 26 26 0 0 1 70 96 H 30 A 26 26 0 0 1 4 70 V 30 A 26 26 0 0 1 30 4 Z"
                pathLength="100"
                strokeDasharray="100 100"
                initial={{ strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: strokeOffset }}
                transition={{ type: "tween", ease: "linear", duration: isActive ? 1.05 : 0.3 }}
              />
            )}
          </svg>
          <div className="timer-clock-content">
            <div className="timer-time">{formatTime(timeLeft)}</div>
          </div>
        </div>

        <div className="timer-settings-section">
          <div className="timer-segments">
            <button 
              className={`timer-segment ${mode === 'western' ? 'active' : ''}`}
              onClick={() => setMode('western')}
            >
              Western
            </button>
            <button 
              className={`timer-segment ${mode === 'gongfu' ? 'active' : ''}`}
              onClick={() => setMode('gongfu')}
            >
              Gongfu
            </button>
          </div>

          <div className="timer-options">
            <AnimatePresence mode="popLayout">
              {mode === 'western' && (
                <motion.div 
                  className="intensity-controls"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <button className={`intensity-btn ${westernIntensity === 0 ? 'active' : ''}`} onClick={() => setWesternIntensity(0)}>Light</button>
                  <button className={`intensity-btn ${westernIntensity === 1 ? 'active' : ''}`} onClick={() => setWesternIntensity(1)}>Medium</button>
                  <button className={`intensity-btn ${westernIntensity === 2 ? 'active' : ''}`} onClick={() => setWesternIntensity(2)}>Strong</button>
                </motion.div>
              )}

              {mode === 'gongfu' && (
                <motion.div 
                  className="gongfu-controls"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <button onClick={() => handleInfusionChange(-1)} disabled={infusion <= 1} className="infusion-btn">
                    <Minus size={12} strokeWidth={2.5} />
                  </button>
                  <div className="infusion-label">
                    Steep {infusion}{infusion >= getMaxSteeps(tea) ? <span className="steep-warn">over‑steeped</span> : `/${getMaxSteeps(tea)}`}
                  </div>
                  <button onClick={() => handleInfusionChange(1)} disabled={infusion >= getMaxSteeps(tea) + 2} className="infusion-btn">
                    <Plus size={12} strokeWidth={2.5} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="timer-actions-row">
            <button className="timer-control-btn primary" onClick={toggleTimer}>
              {isActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />}
              {isActive ? 'Pause' : 'Start'}
            </button>
            <button className="timer-control-btn" onClick={resetTimer} disabled={timeLeft === duration && !isActive}>
              <RotateCcw size={14} strokeWidth={2.5} />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
