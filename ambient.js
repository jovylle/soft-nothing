let ctx = null;
let gain = null;
let source = null;
let playing = false;

function getCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0.06;
    gain.connect(ctx.destination);
  }
  return ctx;
}

function makeNoiseBuffer(audioCtx, seconds = 2) {
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * seconds, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function isAmbientPlaying() {
  return playing;
}

export async function toggleAmbient() {
  const audioCtx = getCtx();

  if (playing) {
    if (source) {
      source.stop();
      source.disconnect();
      source = null;
    }
    playing = false;
    return false;
  }

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const buffer = makeNoiseBuffer(audioCtx);
  source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;

  source.connect(filter);
  filter.connect(gain);
  source.start();
  playing = true;
  return true;
}

export function stopAmbient() {
  if (source) {
    source.stop();
    source.disconnect();
    source = null;
  }
  playing = false;
}
