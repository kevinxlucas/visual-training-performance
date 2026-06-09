// Minimal p5.sound-compatible oscillator wrapper for this game.
// It preserves the existing p5.Oscillator calls without exposing credentials or adding a heavy addon.
(function () {
  let audioContext = null;

  function getContext() {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioContext = Ctx ? new Ctx() : null;
    }
    return audioContext;
  }

  window.userStartAudio = window.userStartAudio || function () {
    const ctx = getContext();
    return ctx && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  };

  if (!window.p5) return;

  window.p5.Oscillator = function Oscillator(type) {
    this.type = type || 'sine';
    this.frequency = 440;
    this.gainValue = 0;
    this.osc = null;
    this.gain = null;
  };

  window.p5.Oscillator.prototype.start = function start() {
    const ctx = getContext();
    if (!ctx || this.osc) return;
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    this.osc.type = this.type;
    this.osc.frequency.value = this.frequency;
    this.gain.gain.value = this.gainValue;
    this.osc.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.osc.start();
  };

  window.p5.Oscillator.prototype.freq = function freq(value, rampTime) {
    this.frequency = Number(value);
    if (this.osc) {
      const ctx = getContext();
      const end = ctx.currentTime + Number(rampTime || 0);
      this.osc.frequency.cancelScheduledValues(ctx.currentTime);
      this.osc.frequency.linearRampToValueAtTime(this.frequency, end);
    }
  };

  window.p5.Oscillator.prototype.amp = function amp(value, rampTime) {
    this.gainValue = Number(value);
    if (this.gain) {
      const ctx = getContext();
      const end = ctx.currentTime + Number(rampTime || 0);
      this.gain.gain.cancelScheduledValues(ctx.currentTime);
      this.gain.gain.linearRampToValueAtTime(this.gainValue, end);
    }
  };
}());
