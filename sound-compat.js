// Minimal p5.sound-compatible oscillator wrapper for this game.
// Preserves the original p5.Oscillator API used by the game without adding credentials or remote code.
(function () {
  let audioContext = null;
  const startedOscillators = new Set();

  function getContext() {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioContext = Ctx ? new Ctx() : null;
    }
    return audioContext;
  }

  function resumeContext() {
    const ctx = getContext();
    if (!ctx) return Promise.resolve();
    return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  }

  window.userStartAudio = function () {
    return resumeContext().then(function () {
      startedOscillators.forEach(function (oscillator) {
        oscillator._ensureStarted();
      });
    });
  };

  if (!window.p5) return;

  window.p5.Oscillator = function Oscillator(type) {
    this.type = type || 'sine';
    this.frequency = 440;
    this.gainValue = 0;
    this.osc = null;
    this.gain = null;
    this.started = false;
  };

  window.p5.Oscillator.prototype._ensureStarted = function _ensureStarted() {
    const ctx = getContext();
    if (!ctx || this.osc) return;
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    this.osc.type = this.type;
    this.osc.frequency.setValueAtTime(this.frequency, ctx.currentTime);
    this.gain.gain.setValueAtTime(this.gainValue, ctx.currentTime);
    this.osc.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.osc.start();
  };

  window.p5.Oscillator.prototype.start = function start() {
    this.started = true;
    startedOscillators.add(this);
    this._ensureStarted();
  };

  window.p5.Oscillator.prototype.freq = function freq(value, rampTime) {
    this.frequency = Number(value);
    this._ensureStarted();
    if (this.osc) {
      const ctx = getContext();
      const now = ctx.currentTime;
      const end = now + Number(rampTime || 0);
      this.osc.frequency.cancelScheduledValues(now);
      this.osc.frequency.setValueAtTime(this.osc.frequency.value, now);
      this.osc.frequency.linearRampToValueAtTime(this.frequency, end);
    }
  };

  window.p5.Oscillator.prototype.amp = function amp(value, rampTime) {
    this.gainValue = Number(value);
    this._ensureStarted();
    if (this.gain) {
      const ctx = getContext();
      const now = ctx.currentTime;
      const end = now + Number(rampTime || 0);
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(this.gainValue, end);
    }
  };
}());
